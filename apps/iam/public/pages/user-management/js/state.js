// Single mutable state object for the user-management page, imported by every
// service module (see SKILL.md "Complex Page Module Architecture").
export const state = {
  currentView: 'dashboard',

  users: [],
  usersQuery: { search: '', department: '', status: '' },

  roles: [],
  rolesLoaded: false,

  policies: [],

  permissionsCatalog: null, // loaded once, refreshed on demand (see permissions.service.js)

  // --- Role form draft ---
  roleForm: {
    editingId: null,
    selectedPolicyIds: [],
  },

  // --- Policy generator draft (Step 1-3 of the policy form) ---
  policyForm: {
    editingId: null,
    activeType: 'ui', // 'ui' | 'api' — matches PolicyStatementInputDTO.plane
    multiSelect: { dd1: [], dd2: [] },
    conditionRows: [],
    conditionCounter: 0,
    statements: [],
  },
};

export function resetPolicyFormDraft() {
  state.policyForm = {
    editingId: null,
    activeType: 'ui',
    multiSelect: { dd1: [], dd2: [] },
    conditionRows: [],
    conditionCounter: 0,
    statements: [],
  };
}

export function resetRoleFormDraft() {
  state.roleForm = { editingId: null, selectedPolicyIds: [] };
}
