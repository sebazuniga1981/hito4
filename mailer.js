const nodemailer = require("nodemailer");

const hasMailConfig = () => {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.MAIL_FROM
  );
};

let transporter = null;

const getTransporter = () => {
  if (!hasMailConfig()) return null;
  if (transporter) return transporter;

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = port === 465;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return transporter;
};

const sendMailSafe = async ({ to, subject, text }) => {
  const tx = getTransporter();
  if (!tx || !to) return false;

  try {
    await tx.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      text
    });
    return true;
  } catch (error) {
    console.error("Error enviando correo:", error.message);
    return false;
  }
};

const sendReservaPendientePacienteEmail = async ({
  to,
  nombreCompleto,
  fecha,
  hora,
  modalidad,
  tipoSesion
}) => {
  const subject = "PsicoConecta: reserva recibida (pendiente)";
  const text = [
    `Hola ${nombreCompleto || "paciente"},`,
    "",
    "Tu solicitud de reserva fue recibida y quedo en estado pendiente.",
    "",
    `Fecha: ${fecha}`,
    `Hora: ${hora}`,
    `Modalidad: ${modalidad}`,
    `Tipo de sesion: ${tipoSesion}`,
    "",
    "Te avisaremos por este medio cuando la psicologa la confirme o rechace.",
    "",
    "Equipo PsicoConecta"
  ].join("\n");

  return sendMailSafe({ to, subject, text });
};

const sendReservaPendienteAdminEmail = async ({
  nombreCompleto,
  emailPaciente,
  fecha,
  hora,
  modalidad,
  tipoSesion
}) => {
  const to = process.env.ADMIN_EMAIL;
  if (!to) return false;

  const subject = "PsicoConecta: nueva reserva pendiente";
  const text = [
    "Se registro una nueva reserva pendiente.",
    "",
    `Paciente: ${nombreCompleto || "Sin nombre"}`,
    `Correo: ${emailPaciente || "Sin correo"}`,
    `Fecha: ${fecha}`,
    `Hora: ${hora}`,
    `Modalidad: ${modalidad}`,
    `Tipo de sesion: ${tipoSesion}`,
    "",
    "Revisa el panel de administracion para aprobar o rechazar."
  ].join("\n");

  return sendMailSafe({ to, subject, text });
};

const sendReservaEstadoPacienteEmail = async ({ to, estado, fecha, hora, modalidad, tipoSesion }) => {
  const estadoTexto = estado === "confirmada" ? "CONFIRMADA" : estado === "rechazada" ? "RECHAZADA" : estado;
  const subject = `PsicoConecta: reserva ${estadoTexto}`;

  const text = [
    `Tu reserva fue actualizada a estado: ${estadoTexto}.`,
    "",
    `Fecha: ${fecha}`,
    `Hora: ${hora}`,
    `Modalidad: ${modalidad}`,
    `Tipo de sesion: ${tipoSesion}`,
    "",
    "Si necesitas cambios, ingresa a tu panel para gestionar la reserva.",
    "",
    "Equipo PsicoConecta"
  ].join("\n");

  return sendMailSafe({ to, subject, text });
};

module.exports = {
  sendReservaPendientePacienteEmail,
  sendReservaPendienteAdminEmail,
  sendReservaEstadoPacienteEmail
};
