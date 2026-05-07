import AutocreateRoleCard from './AutocreateRoleCard';
import { inputClass, labelClass } from '../lib/styles';

export default function AutocreateCategoryForm({ category, onChange, schemaFlags }) {
  const updateCategoryName = (value) => {
    onChange({ ...category, categoryName: value });
  };

  const updateRoles = (roles) => {
    onChange({ ...category, roles });
  };

  const addRole = () => {
    updateRoles([...(category.roles || []), { name: '' }]);
  };

  const updateRole = (index, role) => {
    const roles = [...(category.roles || [])];
    roles[index] = role;
    updateRoles(roles);
  };

  const removeRole = (index) => {
    updateRoles((category.roles || []).filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Category Name</label>
        <input
          className={inputClass}
          value={category.categoryName || ''}
          onChange={(e) => updateCategoryName(e.target.value)}
          placeholder="e.g. {0} Pokemon Alerts"
        />
        <div className="text-[10px] text-gray-600 mt-0.5">
          Supports {'{0}'}, {'{1}'}, ... placeholders from autocreate args
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">
            Roles ({(category.roles || []).length})
          </span>
          <button
            type="button"
            onClick={addRole}
            className="text-[10px] text-gray-500 border border-dashed border-gray-600 rounded px-1.5 py-0.5 hover:text-gray-300 hover:border-gray-400"
          >
            + Add Role
          </button>
        </div>
        {(category.roles || []).map((role, i) => (
          <AutocreateRoleCard
            key={i}
            role={role}
            onChange={(r) => updateRole(i, r)}
            onDelete={() => removeRole(i)}
            schemaFlags={schemaFlags}
          />
        ))}
        {(category.roles || []).length === 0 && (
          <div className="text-xs text-gray-600 italic">No role overwrites</div>
        )}
      </div>
    </div>
  );
}
