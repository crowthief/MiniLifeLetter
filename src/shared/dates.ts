/** Local calendar date as YYYY-MM-DD. Not toISOString(), which is UTC and gives the wrong day near midnight. */
export const localToday = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Future days cannot hold entries. Also rejects anything that is not a plain date. ISO strings compare as text. */
export const isFuture = (date: string, today = localToday()): boolean =>
  !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today
