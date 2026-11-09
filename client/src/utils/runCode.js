// Runs code on the server. Logged-in users send their token, so their runs
// count against their account's limit instead of their IP address.
export const runCode = async ({ language, code, stdin, token }) => {
  const res = await fetch('/api/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    },
    body: JSON.stringify({ language, code, stdin })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
};

// Shows what the program printed and any errors together, so an error or a
// "time limit" note doesn't hide the output that came before it
export const formatRunOutput = ({ stdout = '', stderr = '' }) => {
  if (stdout && stderr && !stdout.endsWith('\n')) return `${stdout}\n${stderr}`;
  return stdout + stderr;
};
