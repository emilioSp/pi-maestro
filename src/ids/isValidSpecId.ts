/**
 * Objective: Validate Maestro spec identifiers.
 * Used: When paths, workflow state, or artifacts refer to a spec.
 */

export const SPEC_ID_PATTERN = /^(\d{8})-(\d{6})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;

const isValidUtcTimestamp = (value: string): boolean => {
  const match = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(value);

  if (match === null) {
    return false;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    match;

  try {
    Temporal.PlainDateTime.from(
      {
        year: Number(yearText),
        month: Number(monthText),
        day: Number(dayText),
        hour: Number(hourText),
        minute: Number(minuteText),
        second: Number(secondText),
      },
      { overflow: 'reject' },
    );
    return true;
  } catch {
    return false;
  }
};

export const isValidSpecId = (value: string): boolean => {
  const match = SPEC_ID_PATTERN.exec(value);
  return match !== null && isValidUtcTimestamp(`${match[1]}-${match[2]}`);
};
