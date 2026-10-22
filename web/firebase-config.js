// Configuração do projeto Firebase da AgroCR.
// Estas chaves são públicas por natureza: elas viajam dentro do aplicativo.
// A segurança de verdade está nas regras do Firestore (firestore.rules),
// que rodam no servidor e ninguém consegue burlar pelo aparelho.
// ("self" em vez de "window" porque este arquivo também roda dentro do
// service worker, onde window não existe.)
self.AGROCR_FIREBASE = {
  apiKey: "AIzaSyBoB3_ZyIHtgvionH1jeQUCYnRG4neeROg",
  authDomain: "agrocr-campo.firebaseapp.com",
  projectId: "agrocr-campo",
  storageBucket: "agrocr-campo.firebasestorage.app",
  messagingSenderId: "997034245509",
  appId: "1:997034245509:web:ad90b11ea0dca4779c98ec",
  measurementId: "G-FR9HCYZRWM",
};

// Chave pública de avisos (Web Push). Enquanto estiver vazia, o botão de
// ativar avisos nem aparece. Vem do console: Configurações do projeto >
// Cloud Messaging > Certificados push da Web > Gerar par de chaves.
self.AGROCR_VAPID = "BPhFYi66JEQe045ZKOskOPmMug6WnRwgCw7jW31UmFp7EJ68NuptmIOU1nhFyIqkHQc5bvQqrZWrxyop-MiQeKE";

// Configuração do Copernicus/Sentinel Hub para os mapas de NDVI
// (índice de vegetação do satélite Sentinel-2, resolução de 10 m).
self.AGROCR_SENTINEL = "9733d083-389b-45ec-ba36-3af0191459b0";

// App Check (reCAPTCHA Enterprise): so o aplicativo oficial fala com o banco e as funcoes.
// Modo observacao: sem enforcement ate confirmar as metricas no console.
self.AGROCR_APPCHECK = "6Lf7j6otAAAAALQfY1iYOcNmuKTK3pk6aNwenSne";
