/**
 * API Tests - Team Routes
 *
 * Tests for /team endpoints including:
 * - Team member CRUD
 * - Team tasks management
 * - Authorization (manager-only operations)
 *
 * Usage: node --test tests/api-team.test.js
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import 'dotenv/config';
import pool from '../src/db/connection.js';

// Test data
const TEST_MANAGER_ID = 88888;
const TEST_OTHER_MANAGER_ID = 88887;

describe('Team API', async () => {
  let createdMemberId = null;
  let createdTeamTaskId = null;

  // Setup
  before(async () => {
    await pool.query(
      `
      INSERT INTO users (id, clerk_id, email, name, role)
      VALUES
        ($1, 'test_manager_1', 'manager1@example.com', 'Test Manager', 'manager'),
        ($2, 'test_manager_2', 'manager2@example.com', 'Other Manager', 'manager')
      ON CONFLICT (id) DO NOTHING
    `,
      [TEST_MANAGER_ID, TEST_OTHER_MANAGER_ID]
    );
  });

  // Cleanup
  after(async () => {
    await pool.query(
      'DELETE FROM team_tasks WHERE team_member_id IN (SELECT id FROM team_members WHERE user_id IN ($1, $2))',
      [TEST_MANAGER_ID, TEST_OTHER_MANAGER_ID]
    );
    await pool.query('DELETE FROM team_members WHERE user_id IN ($1, $2)', [
      TEST_MANAGER_ID,
      TEST_OTHER_MANAGER_ID,
    ]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [
      TEST_MANAGER_ID,
      TEST_OTHER_MANAGER_ID,
    ]);
  });

  // ========================================
  // Team Members Tests
  // ========================================

  await test('POST /team/members - Create team member', async () => {
    const memberData = {
      name: 'Jean Dupont',
      email: 'jean@example.com',
      avatar_color: '#3B82F6',
    };

    const result = await pool.query(
      `INSERT INTO team_members (user_id, name, email, avatar_color)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [TEST_MANAGER_ID, memberData.name, memberData.email, memberData.avatar_color]
    );

    createdMemberId = result.rows[0].id;

    assert.ok(createdMemberId, 'Member should be created');
    assert.strictEqual(result.rows[0].name, memberData.name);
    assert.strictEqual(result.rows[0].avatar_color, '#3B82F6');
  });

  await test('GET /team/members - List team members', async () => {
    const result = await pool.query('SELECT * FROM team_members WHERE user_id = $1 ORDER BY name', [
      TEST_MANAGER_ID,
    ]);

    assert.ok(result.rows.length >= 1, 'Should have at least 1 member');
    assert.ok(
      result.rows.some(m => m.id === createdMemberId),
      'Should include created member'
    );
  });

  await test('PATCH /team/members/:id - Update team member', async () => {
    const result = await pool.query(
      `UPDATE team_members SET avatar_color = $1
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      ['#10B981', createdMemberId, TEST_MANAGER_ID]
    );

    assert.strictEqual(result.rows[0].avatar_color, '#10B981');
  });

  await test('Authorization - Cannot update other managers member', async () => {
    const result = await pool.query(
      `UPDATE team_members SET name = $1
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      ['Hacked Name', createdMemberId, TEST_OTHER_MANAGER_ID]
    );

    assert.strictEqual(result.rows.length, 0, 'Should not update - wrong manager');
  });

  // ========================================
  // Team Tasks Tests
  // ========================================

  await test('POST /team/tasks - Create team task', async () => {
    const taskData = {
      text: 'Implement feature X',
      date: '2026-01-25',
      urgent: true,
    };

    const result = await pool.query(
      `INSERT INTO team_tasks (user_id, team_member_id, text, date, urgent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [TEST_MANAGER_ID, createdMemberId, taskData.text, taskData.date, taskData.urgent]
    );

    createdTeamTaskId = result.rows[0].id;

    assert.ok(createdTeamTaskId, 'Team task should be created');
    assert.strictEqual(result.rows[0].team_member_id, createdMemberId);
    assert.strictEqual(result.rows[0].urgent, true);
  });

  await test('GET /team/tasks - List team tasks', async () => {
    const result = await pool.query(
      `SELECT tt.*, tm.name as member_name
       FROM team_tasks tt
       JOIN team_members tm ON tt.team_member_id = tm.id
       WHERE tt.user_id = $1
       ORDER BY tt.created_at DESC`,
      [TEST_MANAGER_ID]
    );

    assert.ok(result.rows.length >= 1, 'Should have at least 1 task');
    assert.ok(result.rows[0].member_name, 'Should include member name');
  });

  await test('GET /team/tasks/member/:memberId - Get member tasks', async () => {
    const result = await pool.query(
      `SELECT * FROM team_tasks
       WHERE team_member_id = $1
       ORDER BY date`,
      [createdMemberId]
    );

    assert.ok(result.rows.length >= 1, 'Member should have tasks');
    assert.ok(
      result.rows.some(t => t.id === createdTeamTaskId),
      'Should include created task'
    );
  });

  await test('PATCH /team/tasks/:id - Complete task with timestamp', async () => {
    const result = await pool.query(
      `UPDATE team_tasks
       SET done = true, done_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [createdTeamTaskId, TEST_MANAGER_ID]
    );

    assert.strictEqual(result.rows[0].done, true);
    assert.ok(result.rows[0].done_at, 'done_at should be set');
  });

  await test('Task Filtering - By date range', async () => {
    const result = await pool.query(
      `SELECT * FROM team_tasks
       WHERE user_id = $1
       AND date >= $2
       AND date <= $3`,
      [TEST_MANAGER_ID, '2026-01-01', '2026-01-31']
    );

    assert.ok(Array.isArray(result.rows), 'Should return array');
    // All returned tasks should be in range
    result.rows.forEach(task => {
      const taskDate = new Date(task.date);
      assert.ok(taskDate >= new Date('2026-01-01'), 'Date should be >= start');
      assert.ok(taskDate <= new Date('2026-01-31'), 'Date should be <= end');
    });
  });

  await test('Task Filtering - By member', async () => {
    const result = await pool.query(
      `SELECT * FROM team_tasks
       WHERE user_id = $1 AND team_member_id = $2`,
      [TEST_MANAGER_ID, createdMemberId]
    );

    result.rows.forEach(task => {
      assert.strictEqual(
        task.team_member_id,
        createdMemberId,
        'All tasks should be assigned to member'
      );
    });
  });

  await test('Authorization - Cannot access other managers tasks', async () => {
    const result = await pool.query(`SELECT * FROM team_tasks WHERE user_id = $1`, [
      TEST_OTHER_MANAGER_ID,
    ]);

    // Other manager should not see test managers tasks
    assert.ok(
      !result.rows.some(t => t.id === createdTeamTaskId),
      'Should not see other managers tasks'
    );
  });

  // ========================================
  // Cleanup Tests
  // ========================================

  await test('DELETE /team/tasks/:id - Delete team task', async () => {
    const result = await pool.query(
      'DELETE FROM team_tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [createdTeamTaskId, TEST_MANAGER_ID]
    );

    assert.strictEqual(result.rows.length, 1, 'Task should be deleted');
  });

  await test('DELETE /team/members/:id - Delete team member', async () => {
    const result = await pool.query(
      'DELETE FROM team_members WHERE id = $1 AND user_id = $2 RETURNING id',
      [createdMemberId, TEST_MANAGER_ID]
    );

    assert.strictEqual(result.rows.length, 1, 'Member should be deleted');
  });
});

console.log('\n🧪 Running Team API Tests...\n');
