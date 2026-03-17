/**
 * Convert a Date to an ISO 8601 string including timezone offset.
 */
export default function dateToIsoString(date: Date): string {
  const tzo: number = -date.getTimezoneOffset();
  const dif: string = tzo >= 0 ? '+' : '-';
  const pad = (num: number): string => {
    const norm: number = Math.floor(Math.abs(num));
    return (norm < 10 ? '0' : '') + norm;
  };

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}${dif}${pad(tzo / 60)}:${pad(tzo % 60)}`;
}
