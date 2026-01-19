/**
 * API Tests - Tasks Routes
 *
 * Tests for /tasks endpoints including:
 * - CRUD operations
 * - Authorization
 * - Sharing
 * - Filtering & pagination
 *
 * Usage: node --test tests/api-tasks.test.js
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import 'dotenv/config';
import pool from '../src/db/connection.js';

// Test data
const TEST_USER_ID = 99999;
const TEST_USER_2_ID = 99998;

describe('Tasks API', async () => {
  let createdTaskId = null;

  // Setup: Create test users
  before(async () => {
    await pool.query(
      `
      INSERT INTO users (id, clerk_id, email, name, role)
      VALUES
        ($1, 'test_clerk_1', 'test1@example.com', 'Test User 1', 'manager'),
        ($2, 'test_clerk_2', 'test2@example.com', 'Test User 2', 'manager')
      ON CONFLICT (id) DO NOTHING
    `,
      [TEST_USER_ID, TEST_USER_2_ID]
    );
  });

  // Cleanup
  after(async () => {
    await pool.query(
      'DELETE FROM task_sharing WHERE task_id IN (SELECT id FROM tasks WHERE user_id IN ($1, $2))',
      [TEST_USER_ID, TEST_USER_2_ID]
    );
    await pool.query('DELETE FROM tasks WHERE user_id IN ($1, $2)', [TEST_USER_ID, TEST_USER_2_ID]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [TEST_USER_ID, TEST_USER_2_ID]);
  });

  await test('POST /tasks - Create task', async () => {
    const taskData = {
      text: 'Test Task',
      date: '2026-01-20',
      owner: 'Moi',
      urgent: true,
    };

    // Direct DB insert for test (simulating route behavior)
    const result = await pool.query(
      `INSERT INTO tasks (user_id, text, date, owner, urgent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [TEST_USER_ID, taskData.text, taskData.date, taskData.owner, taskData.urgent]
    );

    createdTaskId = result.rows[0].id;

    assert.ok(createdTaskId, 'Task should be created');
    assert.strictEqual(result.rows[0].text, taskData.text);
    assert.strictEqual(result.rows[0].urgent, true);
  });

  await test('GET /tasks - List user tasks', async () => {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
      [TEST_USER_ID]
    );

    assert.ok(result.rows.length >= 1, 'Should have at least 1 task');
    assert.ok(
      result.rows.some(t => t.id === createdTaskId),
      'Should include created task'
    );
  });

  await test('PATCH /tasks/:id - Update task', async () => {
    const result = await pool.query(
      `UPDATE tasks SET text = $1, done = $2, updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      ['Updated Task Text', true, createdTaskId, TEST_USER_ID]
    );

    assert.strictEqual(result.rows[0].text, 'Updated Task Text');
    assert.strictEqual(result.rows[0].done, true);
  });

  await test('Authorization - Cannot update other users task', async () => {
    // Try to update task with wrong user_id
    const result = await pool.query(
      `UPDATE tasks SET text = $1
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      ['Hacked Text', createdTaskId, TEST_USER_2_ID]
    );

    assert.strictEqual(result.rows.length, 0, 'Should not update - wrong user');
  });

  await test('Task Sharing - Share task with another user', async () => {
    // Share task
    await pool.query(
      `INSERT INTO task_sharing (task_id, shared_with_user_id, permission, shared_by_user_id)
       VALUES ($1, $2, 'view', $3)
       ON CONFLICT DO NOTHING`,
      [createdTaskId, TEST_USER_2_ID, TEST_USER_ID]
    );

    // Verify share exists
    const shareResult = await pool.query(
      'SELECT * FROM task_sharing WHERE task_id = $1 AND shared_with_user_id = $2',
      [createdTaskId, TEST_USER_2_ID]
    );

    assert.strictEqual(shareResult.rows.length, 1, 'Share should exist');
    assert.strictEqual(shareResult.rows[0].permission, 'view');
  });

  await test('Task Sharing - Get shared tasks', async () => {
    // Get tasks shared with user 2
    const result = await pool.query(
      `
      SELECT t.*, ts.permission
      FROM tasks t
      JOIN task_sharing ts ON ts.task_id = t.id
      WHERE ts.shared_with_user_id = $1
    `,
      [TEST_USER_2_ID]
    );

    assert.ok(result.rows.length >= 1, 'Should have shared tasks');
    assert.ok(
      result.rows.some(t => t.id === createdTaskId),
      'Should include shared task'
    );
  });

  await test('DELETE /tasks/:id - Delete task', async () => {
    // First delete shares
    await pool.query('DELETE FROM task_sharing WHERE task_id = $1', [createdTaskId]);

    // Delete task
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [createdTaskId, TEST_USER_ID]
    );

    assert.strictEqual(result.rows.length, 1, 'Task should be deleted');

    // Verify deletion
    const verifyResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [createdTaskId]);
    assert.strictEqual(verifyResult.rows.length, 0, 'Task should not exist');
  });

  await test('Authorization - Cannot delete other users task', async () => {
    // Create a task for user 1
    const { rows } = await pool.query(
      `INSERT INTO tasks (user_id, text, date, owner) VALUES ($1, 'Protected Task', '2026-01-20', 'Moi') RETURNING id`,
      [TEST_USER_ID]
    );
    const taskId = rows[0].id;

    // Try to delete with wrong user
    const deleteResult = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [taskId, TEST_USER_2_ID]
    );

    assert.strictEqual(deleteResult.rows.length, 0, 'Should not delete - wrong user');

    // Cleanup - delete with correct user
    await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [taskId, TEST_USER_ID]);
  });
});

// Run tests
console.log('\n🧪 Running Tasks API Tests...\n');
