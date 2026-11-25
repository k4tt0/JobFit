export function validateSkillIds(value, { allowEmpty }) {
  // Validate request shape before opening a database transaction.
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw Object.assign(
      new Error(allowEmpty ? 'skillIds must be an array.' : 'requiredSkillIds must be a non-empty array.'),
      { status: 400 },
    );
  }

  if (!value.every((id) => Number.isInteger(id) && id > 0)) {
    throw Object.assign(new Error('Skill IDs must be positive integers.'), { status: 400 });
  }

  if (new Set(value).size !== value.length) {
    throw Object.assign(new Error('Skill IDs must not contain duplicates.'), { status: 400 });
  }

  return value;
}
