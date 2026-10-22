(async function () {
  if (session.token && session.user) {
    location.href = HOME_BY_ROLE[session.user.role] || '/';
    return;
  }

  let role = 'passenger';
  let mode = 'register';
  let photoData = null;

  const form = document.getElementById('auth-form');
  const errorBox = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');

  function render() {
    document.querySelectorAll('[data-role]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.role === role)));
    document.querySelectorAll('[data-only]').forEach((node) => {
      const needs = node.dataset.only.split(' ');
      node.hidden = !needs.every((n) => n === mode || n === role);
    });
    const titleKey = mode === 'register' ? 'register' : 'login';
    document.getElementById('form-title').dataset.i18n = titleKey;
    submitBtn.dataset.i18n = titleKey;
    document.getElementById('mode-toggle').dataset.i18n = mode === 'register' ? 'haveAccount' : 'noAccount';
    document.getElementById('password').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    applyI18n();
  }

  document.querySelectorAll('[data-role]').forEach((b) =>
    b.addEventListener('click', () => {
      role = b.dataset.role;
      render();
    })
  );

  document.getElementById('mode-toggle').addEventListener('click', () => {
    mode = mode === 'register' ? 'login' : 'register';
    errorBox.textContent = '';
    render();
  });

  // Reduce la foto a 320px para no subir imágenes enormes
  document.getElementById('photo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    photoData = await resizeImage(file, 320);
    const preview = document.getElementById('photo-preview');
    preview.src = photoData;
    preview.hidden = false;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.textContent = '';
    const data = Object.fromEntries(new FormData(form));
    delete data.photo;
    submitBtn.disabled = true;
    try {
      const result =
        mode === 'login'
          ? await api('POST', '/api/auth/login', { phone: data.phone, password: data.password })
          : await api('POST', '/api/auth/register', { ...data, role, photo: role === 'driver' ? photoData : undefined });
      session.save(result.token, result.user);
      location.href = HOME_BY_ROLE[result.user.role];
    } catch (err) {
      errorBox.textContent = errorText(err);
    } finally {
      submitBtn.disabled = false;
    }
  });

  setupLangToggle();
  render();
  getConfig()
    .then((cfg) => {
      document.getElementById('town').textContent = cfg.townName;
      document.title = `${t('appName')} · ${cfg.townName}`;
    })
    .catch(() => {});
})();

function resizeImage(file, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, size / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
