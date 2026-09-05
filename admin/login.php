<?php

require_once __DIR__ . '/config.php';

if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $password = (string) ($_POST['password'] ?? '');
  if ($password === ADMIN_PASSWORD) {
    $_SESSION['vildmarken_admin'] = true;
    header('Location: index.php');
    exit;
  }
  $error = 'Forkert adgangskode.';
}

if (!empty($_SESSION['vildmarken_admin'])) {
  header('Location: index.php');
  exit;
}
?>
<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login — Nørholm Vildmark Admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-[#022c22] flex items-center justify-center p-4">
  <div class="w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-8">
    <div class="text-center mb-8">
      <img src="https://naturaudio.dk/vildmarken/Norholm_Vildmark.png" alt="Nørholm Vildmark" class="h-14 mx-auto mb-4">
      <h1 class="text-2xl font-black text-[#1a3a32]">Admin login</h1>
      <p class="text-stone-500 text-sm mt-2">Rediger lydpunkter for Vildmarken</p>
    </div>

    <?php if ($error !== ''): ?>
      <div class="mb-4 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm font-medium">
        <?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?>
      </div>
    <?php endif; ?>

    <form method="post" class="space-y-4">
      <div>
        <label for="password" class="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Adgangskode</label>
        <input
          type="password"
          id="password"
          name="password"
          required
          autofocus
          class="w-full rounded-xl border border-stone-200 px-4 py-3 text-[#1a3a32] focus:outline-none focus:ring-2 focus:ring-emerald-600"
        >
      </div>
      <button type="submit" class="w-full py-3 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition-colors">
        Log ind
      </button>
    </form>
  </div>
</body>
</html>
