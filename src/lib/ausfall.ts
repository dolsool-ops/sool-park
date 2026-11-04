// Wednesdays on which the seminar does not meet (ISO dates). The overview lists them between the
// sessions, and the pages of the sessions before and after mention them. The session dates
// themselves are set in src/content/sitzungen.
export const AUSFAELLE: string[] = ['2026-11-11'];

export const datumText = (iso: string) =>
	new Date(`${iso}T00:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
