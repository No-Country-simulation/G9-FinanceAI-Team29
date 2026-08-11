// Service worker mínimo: solo escucha pushes del calendario financiero y
// abre/enfoca la pestaña de la app al hacer click en la notificación.
self.addEventListener("push", (event) => {
  let data = { title: "Recordatorio financiero", body: "Tenés novedades en tu calendario.", url: "/calendario-financiero" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Si el payload no es JSON, se usa el mensaje por defecto.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/images/mascot/mascot-thinking.png",
      badge: "/images/mascot/mascot-thinking.png",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/calendario-financiero";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
