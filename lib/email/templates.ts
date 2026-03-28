export function inviteEmailSubject() {
  return "Acceso habilitado — Summer87 Intelligence (Ingreso con Google)";
}

export function inviteEmailHtml(params: {
  appUrl: string;
  email: string;
  roleName?: string;
}) {
  const { appUrl, email, roleName } = params;

  return `
  <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
    <h2>Acceso habilitado — Summer87 Intelligence</h2>
    <p>Hola,</p>
    <p>Se habilitó tu acceso a la suite con el correo:</p>
    <p><strong>${email}</strong>${roleName ? ` (Rol: ${roleName})` : ""}</p>
    <p>Para ingresar, utilizá el botón <strong>"Continuar con Google"</strong> con este mismo correo.</p>
    <p style="margin:20px 0">
      <a href="${appUrl}/login"
         style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">
         Ir al Login
      </a>
    </p>
    <p>Si tenés inconvenientes, respondé este correo.</p>
    <hr style="border:none;border-top:1px solid #eee;margin-top:20px" />
    <small>Este correo es informativo. El acceso se realiza mediante Google OAuth.</small>
  </div>
  `;
}
