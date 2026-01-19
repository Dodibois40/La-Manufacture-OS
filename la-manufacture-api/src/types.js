/**
 * JSDoc Type Definitions for La Manufacture OS API
 *
 * These types provide IDE autocomplete and documentation.
 * Import with: @typedef {import('./types.js').Task} Task
 */

// ============================================================================
// Core Entities
// ============================================================================

/**
 * @typedef {Object} User
 * @property {number} id - User ID
 * @property {string} email - User email
 * @property {string} clerk_id - Clerk authentication ID
 * @property {string} name - Display name
 * @property {'manager' | 'member' | 'admin'} role - User role
 * @property {Date} created_at - Creation timestamp
 * @property {Date} updated_at - Last update timestamp
 */

/**
 * @typedef {Object} Task
 * @property {string} id - UUID
 * @property {number} user_id - Owner user ID
 * @property {string} text - Task description
 * @property {string} date - ISO date (YYYY-MM-DD)
 * @property {string} [original_date] - Original date before carry-over
 * @property {string} owner - Owner label ("Moi", team member name, etc.)
 * @property {string} [assignee] - Assignee name
 * @property {'open' | 'en_attente' | 'delegue' | 'bloque' | 'termine'} status - Task status
 * @property {boolean} urgent - Is task urgent
 * @property {boolean} done - Is task completed
 * @property {number} time_spent - Time spent in minutes
 * @property {boolean} [is_event] - Is this a calendar event
 * @property {string} [start_time] - Event start time (HH:MM)
 * @property {string} [end_time] - Event end time (HH:MM)
 * @property {string} [location] - Event location
 * @property {string} [google_event_id] - Google Calendar event ID
 * @property {string} [project_id] - Associated project UUID
 * @property {Date} created_at - Creation timestamp
 * @property {Date} updated_at - Last update timestamp
 */

/**
 * @typedef {Object} TeamMember
 * @property {number} id - Member ID
 * @property {number} user_id - Manager's user ID
 * @property {string} name - Member display name
 * @property {string} avatar_color - Hex color for avatar (#RRGGBB)
 * @property {boolean} active - Is member active
 * @property {number} [invited_user_id] - Linked user account ID
 * @property {string} [email] - Member email
 * @property {'member' | 'manager'} role - Member role
 * @property {Date} created_at - Creation timestamp
 * @property {Date} updated_at - Last update timestamp
 */

/**
 * @typedef {Object} TeamTask
 * @property {number} id - Task ID
 * @property {number} user_id - Manager's user ID
 * @property {number} team_member_id - Assigned team member ID
 * @property {string} text - Task description
 * @property {string} date - ISO date (YYYY-MM-DD)
 * @property {boolean} urgent - Is task urgent
 * @property {boolean} done - Is task completed
 * @property {Date} [done_at] - Completion timestamp
 * @property {'open' | 'in_progress' | 'completed' | 'blocked'} status - Task status
 * @property {number} time_spent - Time spent in minutes
 * @property {Date} created_at - Creation timestamp
 * @property {Date} updated_at - Last update timestamp
 */

/**
 * @typedef {Object} Project
 * @property {string} id - UUID
 * @property {number} user_id - Manager's user ID
 * @property {string} name - Project name
 * @property {string} [description] - Project description
 * @property {string} [deadline] - ISO date
 * @property {'active' | 'completed' | 'archived'} status - Project status
 * @property {Date} created_at - Creation timestamp
 * @property {Date} updated_at - Last update timestamp
 */

/**
 * @typedef {Object} TeamInvitation
 * @property {number} id - Invitation ID
 * @property {number} manager_id - Manager's user ID
 * @property {string} email - Invited email
 * @property {string} token - Unique invitation token
 * @property {number} [team_member_id] - Associated team member ID
 * @property {'pending' | 'accepted' | 'revoked' | 'expired'} status - Invitation status
 * @property {Date} invited_at - Invitation timestamp
 * @property {Date} expires_at - Token expiration
 * @property {Date} [accepted_at] - Acceptance timestamp
 * @property {Object} [metadata] - Additional data (invited user name, etc.)
 * @property {Date} created_at - Creation timestamp
 * @property {Date} updated_at - Last update timestamp
 */

/**
 * @typedef {Object} Note
 * @property {string} id - UUID
 * @property {number} user_id - Owner user ID
 * @property {string} title - Note title
 * @property {string} [content] - Note content (markdown)
 * @property {string} [color] - Note color (blue, green, yellow, orange, red, purple)
 * @property {boolean} is_pinned - Is note pinned
 * @property {string} [project_id] - Associated project UUID
 * @property {string} [task_id] - Associated task UUID
 * @property {Date} [archived_at] - Soft-delete timestamp
 * @property {Date} created_at - Creation timestamp
 * @property {Date} updated_at - Last update timestamp
 */

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * @typedef {Object} AuthenticatedRequest
 * @property {Object} user - Authenticated user info
 * @property {number} user.id - User ID from database
 * @property {string} user.clerkId - Clerk user ID
 * @property {string} user.email - User email
 * @property {string} user.role - User role
 */

/**
 * @typedef {Object} TaskCreateInput
 * @property {string} text - Task description
 * @property {string} date - ISO date (YYYY-MM-DD)
 * @property {string} [owner] - Owner label (defaults to "Moi")
 * @property {boolean} [urgent] - Is task urgent
 * @property {boolean} [is_event] - Is this a calendar event
 * @property {string} [start_time] - Event start time (HH:MM)
 * @property {string} [end_time] - Event end time (HH:MM)
 * @property {string} [location] - Event location
 * @property {string} [project_id] - Associated project UUID
 */

/**
 * @typedef {Object} TaskUpdateInput
 * @property {string} [text] - Task description
 * @property {string} [date] - ISO date (YYYY-MM-DD)
 * @property {string} [owner] - Owner label
 * @property {string} [status] - Task status
 * @property {boolean} [urgent] - Is task urgent
 * @property {boolean} [done] - Is task completed
 * @property {number} [time_spent] - Time spent in minutes
 */

/**
 * @typedef {Object} TeamMemberCreateInput
 * @property {string} name - Member display name
 * @property {string} [email] - Member email
 * @property {string} [avatar_color] - Hex color for avatar
 */

/**
 * @typedef {Object} TeamTaskCreateInput
 * @property {number} team_member_id - Assigned team member ID
 * @property {string} text - Task description
 * @property {string} date - ISO date (YYYY-MM-DD)
 * @property {boolean} [urgent] - Is task urgent
 */

/**
 * @typedef {Object} InvitationCreateInput
 * @property {string} email - Email to invite
 * @property {number} [team_member_id] - Existing team member to link
 * @property {Object} [metadata] - Additional data (name, etc.)
 */

/**
 * @typedef {Object} ProjectCreateInput
 * @property {string} name - Project name
 * @property {string} [description] - Project description
 * @property {string} [deadline] - ISO date
 * @property {number[]} [member_ids] - Team member IDs to assign
 */

// ============================================================================
// AI/QUASAR Types
// ============================================================================

/**
 * @typedef {Object} ParsedItem
 * @property {'task' | 'event' | 'note'} type - Item type
 * @property {string} text - Item text/description
 * @property {string} [title] - Note title (for notes)
 * @property {string} [date] - ISO date (YYYY-MM-DD)
 * @property {string} [start_time] - Event start time (HH:MM)
 * @property {string} [end_time] - Event end time (HH:MM)
 * @property {boolean} [urgent] - Is item urgent
 * @property {string[]} [people] - People mentioned
 * @property {string} [location] - Location mentioned
 * @property {number} confidence - Parsing confidence (0-1)
 * @property {string[]} [suggestions] - Follow-up suggestions
 */

/**
 * @typedef {Object} ParseResult
 * @property {ParsedItem[]} items - Parsed items
 * @property {string} [raw_input] - Original input text
 * @property {string} [language] - Detected language
 */

/**
 * @typedef {Object} ParseTelemetry
 * @property {number} total_latency - Total processing time (ms)
 * @property {number} [stage1_latency] - Stage 1 latency (ms)
 * @property {number} [stage2_latency] - Stage 2 latency (ms)
 * @property {number} input_tokens - Input tokens used
 * @property {number} output_tokens - Output tokens used
 * @property {boolean} [cache_hit] - Was prompt cache hit
 * @property {string} model - Model used
 */

// ============================================================================
// Settings Types
// ============================================================================

/**
 * @typedef {Object} UserSettings
 * @property {number} id - Settings ID
 * @property {number} user_id - User ID
 * @property {string[]} owners - Available owner labels
 * @property {'move' | 'duplicate' | 'manual'} carry_over_mode - How to handle late tasks
 * @property {boolean} ai_enabled - Is AI features enabled
 * @property {Date} created_at - Creation timestamp
 * @property {Date} updated_at - Last update timestamp
 */

/**
 * @typedef {Object} GoogleTokens
 * @property {number} id - Token ID
 * @property {number} user_id - User ID
 * @property {string} access_token - OAuth access token
 * @property {string} refresh_token - OAuth refresh token
 * @property {Date} token_expiry - Token expiration
 * @property {string} calendar_id - Google Calendar ID
 * @property {Date} created_at - Creation timestamp
 * @property {Date} updated_at - Last update timestamp
 */

// Export empty object for ES module compatibility
export {};
