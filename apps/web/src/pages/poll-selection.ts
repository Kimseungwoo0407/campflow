export function nextPollSelection(
  currentOptionIds: string[],
  optionId: string,
  maxSelections: number,
) {
  const limit = Math.max(1, maxSelections);
  const isSelected = currentOptionIds.includes(optionId);

  if (limit === 1) {
    return isSelected && currentOptionIds.length === 1 ? currentOptionIds : [optionId];
  }
  if (isSelected) {
    return currentOptionIds.length === 1
      ? currentOptionIds
      : currentOptionIds.filter((currentId) => currentId !== optionId);
  }
  if (currentOptionIds.length >= limit) {
    return currentOptionIds;
  }
  return [...currentOptionIds, optionId];
}
