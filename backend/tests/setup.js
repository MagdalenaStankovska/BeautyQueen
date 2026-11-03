// Appointment times are salon-local; run every test in the salon's time zone.
process.env.TZ = "Europe/Skopje";
process.env.NODE_ENV = "test";
