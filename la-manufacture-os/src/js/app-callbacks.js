/**
 * Application callbacks registry
 * Used to avoid circular dependencies between modules
 */
export const appCallbacks = {
  render: null,
  setView: null
};
