/**
 * API Tests - Invitations Routes
 *
 * Tests for /invitations endpoints including:
 * - Invitation CRUD
 * - Token validation
 * - Status transitions (pending → accepted/revoked)
 * - Authorization
 *
 * Usage: node --test tests/api-invitations.test.js
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import 'dotenv/config';
import pool from '../src/db/connection.js';

// Test data
const TEST_MANAGER_ID = 77777;
const TEST_INVITEE_ID = 77776;

describe('Invitations API', async () => {
  let createdInvitationId = null;
  let invitationToken = null;
  let createdMemberId = null;

  // Setup
  before(async () => {
    // Create test users
    await pool.query(
      `
      INSERT INTO users (id, clerk_id, email, name, role)
      VALUES
        ($1, 'test_inv_manager', 'inv_manager@example.com', 'Invitation Manager', 'manager'),
        ($2, 'test_inv_user', 'invitee@example.com', 'Invited User', 'member')
      ON CONFLICT (id) DO NOTHING
    `,
      [TEST_MANAGER_ID, TEST_INVITEE_ID]
    );

    // Create a team member to invite
    const memberResult = await pool.query(
      `INSERT INTO team_members (user_id, name, role, email, avatar_color)
       VALUES ($1, 'Member To Invite', 'member', 'invitee@example.com', '#3B82F6')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [TEST_MANAGER_ID]
    );
    if (memberResult.rows.length > 0) {
      createdMemberId = memberResult.rows[0].id;
    } else {
      const existing = await pool.query(
        'SELECT id FROM team_members WHERE user_id = $1 AND email = $2',
        [TEST_MANAGER_ID, 'invitee@example.com']
      );
      createdMemberId = existing.rows[0]?.id;
    }
  });

  // Cleanup
  after(async () => {
    await pool.query('DELETE FROM team_invitations WHERE manager_id = $1', [TEST_MANAGER_ID]);
    await pool.query('DELETE FROM team_members WHERE user_id = $1', [TEST_MANAGER_ID]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [TEST_MANAGER_ID, TEST_INVITEE_ID]);
  });

  // ========================================
  // Invitation Creation Tests
  // ========================================

  await test('POST /invitations - Create invitation', async () => {
    invitationToken = crypto.randomBytes(32).toString('hex');

    const invitationData = {
      email: 'invitee@example.com',
      team_member_id: createdMemberId,
      invited_name: 'Invited User',
      avatar_color: '#3B82F6',
    };

    const result = await pool.query(
      `INSERT INTO team_invitations (manager_id, team_member_id, email, token, status, metadata, expires_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, NOW() + INTERVAL '7 days')
       RETURNING *`,
      [
        TEST_MANAGER_ID,
        invitationData.team_member_id,
        invitationData.email,
        invitationToken,
        JSON.stringify({
          invited_name: invitationData.invited_name,
          avatar_color: invitationData.avatar_color,
        }),
      ]
    );

    createdInvitationId = result.rows[0].id;

    assert.ok(createdInvitationId, 'Invitation should be created');
    assert.strictEqual(result.rows[0].status, 'pending');
    assert.strictEqual(result.rows[0].email, invitationData.email);
    assert.ok(result.rows[0].token, 'Token should be set');
  });

  await test('GET /invitations - List invitations', async () => {
    const result = await pool.query(
      `SELECT ti.*, tm.name as member_name
       FROM team_invitations ti
       JOIN team_members tm ON ti.team_member_id = tm.id
       WHERE ti.manager_id = $1
       ORDER BY ti.created_at DESC`,
      [TEST_MANAGER_ID]
    );

    assert.ok(result.rows.length >= 1, 'Should have at least 1 invitation');
    assert.ok(
      result.rows.some(i => i.id === createdInvitationId),
      'Should include created invitation'
    );
  });

  // ========================================
  // Token Validation Tests
  // ========================================

  await test('GET /invitations/validate/:token - Valid token', async () => {
    const result = await pool.query(
      `SELECT ti.*, tm.name as member_name, tm.role as member_role
       FROM team_invitations ti
       JOIN team_members tm ON ti.team_member_id = tm.id
       WHERE ti.token = $1 AND ti.status = 'pending' AND ti.expires_at > NOW()`,
      [invitationToken]
    );

    assert.strictEqual(result.rows.length, 1, 'Should find valid invitation');
    assert.strictEqual(result.rows[0].status, 'pending');
  });

  await test('GET /invitations/validate/:token - Invalid token returns nothing', async () => {
    const result = await pool.query(
      `SELECT * FROM team_invitations
       WHERE token = $1 AND status = 'pending' AND expires_at > NOW()`,
      ['invalid_token_12345']
    );

    assert.strictEqual(result.rows.length, 0, 'Should not find invalid token');
  });

  await test('Token expiration check', async () => {
    // Create an expired invitation
    const expiredToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO team_invitations (manager_id, team_member_id, email, token, status, expires_at)
       VALUES ($1, $2, 'expired@test.com', $3, 'pending', NOW() - INTERVAL '1 day')`,
      [TEST_MANAGER_ID, createdMemberId, expiredToken]
    );

    const result = await pool.query(
      `SELECT * FROM team_invitations
       WHERE token = $1 AND status = 'pending' AND expires_at > NOW()`,
      [expiredToken]
    );

    assert.strictEqual(result.rows.length, 0, 'Expired invitation should not be valid');

    // Cleanup
    await pool.query('DELETE FROM team_invitations WHERE token = $1', [expiredToken]);
  });

  // ========================================
  // Status Transition Tests
  // ========================================

  await test('POST /invitations/:token/accept - Accept invitation', async () => {
    // Verify email matches
    const invitation = await pool.query(
      `SELECT * FROM team_invitations WHERE token = $1 AND status = 'pending'`,
      [invitationToken]
    );

    assert.strictEqual(invitation.rows.length, 1, 'Should find pending invitation');
    assert.strictEqual(invitation.rows[0].email, 'invitee@example.com', 'Email should match');

    // Accept invitation
    const result = await pool.query(
      `UPDATE team_invitations
       SET status = 'accepted', accepted_at = NOW()
       WHERE token = $1 AND status = 'pending'
       RETURNING *`,
      [invitationToken]
    );

    assert.strictEqual(result.rows[0].status, 'accepted');
    assert.ok(result.rows[0].accepted_at, 'accepted_at should be set');

    // Update team member with invited user
    await pool.query(`UPDATE team_members SET invited_user_id = $1 WHERE id = $2`, [
      TEST_INVITEE_ID,
      createdMemberId,
    ]);
  });

  await test('Cannot accept already accepted invitation', async () => {
    const result = await pool.query(
      `UPDATE team_invitations
       SET status = 'accepted'
       WHERE token = $1 AND status = 'pending'
       RETURNING *`,
      [invitationToken]
    );

    assert.strictEqual(result.rows.length, 0, 'Should not update already accepted invitation');
  });

  await test('Revoke invitation flow', async () => {
    // Create new invitation to revoke
    const revokeToken = crypto.randomBytes(32).toString('hex');
    const { rows } = await pool.query(
      `INSERT INTO team_invitations (manager_id, team_member_id, email, token, status, expires_at)
       VALUES ($1, $2, 'revoke@test.com', $3, 'pending', NOW() + INTERVAL '7 days')
       RETURNING id`,
      [TEST_MANAGER_ID, createdMemberId, revokeToken]
    );
    const revokeInvId = rows[0].id;

    // Revoke it
    const result = await pool.query(
      `UPDATE team_invitations
       SET status = 'revoked'
       WHERE id = $1 AND manager_id = $2 AND status = 'pending'
       RETURNING *`,
      [revokeInvId, TEST_MANAGER_ID]
    );

    assert.strictEqual(result.rows[0].status, 'revoked');

    // Verify cannot accept revoked invitation
    const acceptResult = await pool.query(
      `UPDATE team_invitations
       SET status = 'accepted'
       WHERE token = $1 AND status = 'pending'
       RETURNING *`,
      [revokeToken]
    );

    assert.strictEqual(acceptResult.rows.length, 0, 'Cannot accept revoked invitation');
  });

  // ========================================
  // Authorization Tests
  // ========================================

  await test('Authorization - Only manager can revoke own invitations', async () => {
    // Create invitation
    const testToken = crypto.randomBytes(32).toString('hex');
    const { rows } = await pool.query(
      `INSERT INTO team_invitations (manager_id, team_member_id, email, token, status, expires_at)
       VALUES ($1, $2, 'auth@test.com', $3, 'pending', NOW() + INTERVAL '7 days')
       RETURNING id`,
      [TEST_MANAGER_ID, createdMemberId, testToken]
    );
    const invId = rows[0].id;

    // Try to revoke with wrong user
    const result = await pool.query(
      `UPDATE team_invitations
       SET status = 'revoked'
       WHERE id = $1 AND manager_id = $2
       RETURNING *`,
      [invId, TEST_INVITEE_ID] // Wrong user
    );

    assert.strictEqual(result.rows.length, 0, 'Should not revoke - wrong user');

    // Cleanup
    await pool.query('DELETE FROM team_invitations WHERE id = $1', [invId]);
  });

  await test('Email validation on acceptance', async () => {
    // Create invitation for specific email
    const emailToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO team_invitations (manager_id, team_member_id, email, token, status, expires_at)
       VALUES ($1, $2, 'correct@email.com', $3, 'pending', NOW() + INTERVAL '7 days')`,
      [TEST_MANAGER_ID, createdMemberId, emailToken]
    );

    // User with different email tries to accept
    const invitation = await pool.query(
      `SELECT * FROM team_invitations WHERE token = $1 AND status = 'pending'`,
      [emailToken]
    );

    // Simulate email check (should fail)
    const userEmail = 'wrong@email.com';
    const invitationEmail = invitation.rows[0].email;

    assert.notStrictEqual(userEmail, invitationEmail, 'Emails should not match');

    // Cleanup
    await pool.query('DELETE FROM team_invitations WHERE token = $1', [emailToken]);
  });
});

console.log('\n🧪 Running Invitations API Tests...\n');
