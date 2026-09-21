// Maestro spec identifier utilities.

export const SPEC_ID_PATTERN = /^(\d{8})-(\d{6})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export const formatUtcTimestamp = (instant: Temporal.Instant): string => {
  const utc = instant
    .toZonedDateTimeISO('UTC')
    .toPlainDateTime()
    .toString({ smallestUnit: 'second', calendarName: 'never' });
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(utc);

  if (match === null) {
    throw new Error('UTC timestamp year must have four digits.');
  }

  return `${match[1]}${match[2]}${match[3]}-${match[4]}${match[5]}${match[6]}`;
};

export const normalizeSlug = (value: string): string => {
  const slug = value
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length === 0) {
    throw new Error('Spec slug must contain at least one letter or number.');
  }

  return slug;
};

type CreateSpecIdInput = {
  title: string;
  instant?: Temporal.Instant;
};

export const createSpecId = ({
  title,
  instant = Temporal.Now.instant(),
}: CreateSpecIdInput): string =>
  `${formatUtcTimestamp(instant)}-${normalizeSlug(title)}`;

export const isValidUtcTimestamp = (value: string): boolean => {
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
