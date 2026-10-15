const pad = (n) => String(n).padStart(2, '0');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toUtc(str) {
  const [y, m, d] = str.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function daysBetween(start, end) {
  return Math.round((toUtc(end) - toUtc(start)) / 86400000);
}

module.exports = { todayStr, daysBetween };
