const GAS_URL = "https://script.google.com/macros/s/AKfycbwrN2-4gJUJQ5X4Ic5AOuIQdXwNKInBMwTWmwiffZABrAYpeJ93rt5M5NgkVvuEjw4I/exec";

export async function api(action, payload = {}) {
  const res = await fetch(GAS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action, ...payload })
  });

  return res.json();
}
