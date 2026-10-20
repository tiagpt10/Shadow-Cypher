"use strict";

// Cada posição das tabelas corresponde à mesma posição na tabela cifrada.
const UPPER_PLAIN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const UPPER_CIPHER = "XMQZBTW C LEUGIFRAVKDYJPHNOS".replaceAll(" ", "");
const LOWER_PLAIN = "abcdefghijklmnopqrstuvwxyz";
const LOWER_CIPHER = "rkwqmzbyentpsxdauglcfoihjv";

function makeMap(plain, cipher) {
  return Object.fromEntries(Array.from(plain, (character, index) => [character, Array.from(cipher)[index]]));
}

const plainToCipher = {
  ...makeMap(UPPER_PLAIN, UPPER_CIPHER),
  ...makeMap(LOWER_PLAIN, LOWER_CIPHER),
};
const cipherToPlain = Object.fromEntries(Object.entries(plainToCipher).map(([plain, cipher]) => [cipher, plain]));

// Os algarismos avançam sete posições, voltando ao zero depois do nove.
const digitToCipher = Object.fromEntries(Array.from("0123456789", (digit) => [digit, String((Number(digit) + 7) % 10)]));
const cipherToDigit = Object.fromEntries(Object.entries(digitToCipher).map(([digit, cipher]) => [cipher, digit]));
const punctuationToCipher = { ".": "§", ",": "°", ";": "<", ":": ">", "?": "[", "!": "]", "…": "{", "'": "}", '"': "(", "(": ")", ")": "`", "-": "^", "—": "¨", " ": " " };
const cipherToPunctuation = Object.fromEntries(Object.entries(punctuationToCipher).map(([plain, cipher]) => [cipher, plain]));

// O sufixo é anexado à letra cifrada. As formas longas vêm primeiro na descodificação.
const accentSuffix = {
  "á": "?", "à": "!", "â": "?!", "ã": "!?", "é": "?", "ê": "?!",
  "í": "?", "ó": "?", "ô": "?!", "õ": "!?", "ú": "?", "ç": "!",
  "Á": "?", "À": "!", "Â": "?!", "Ã": "!?", "É": "?", "Ê": "?!",
  "Í": "?", "Ó": "?", "Ô": "?!", "Õ": "!?", "Ú": "?", "Ç": "!",
};
const accentsByBaseAndSuffix = {
  a: { "?!": "â", "!?": "ã", "?": "á", "!": "à" },
  e: { "?!": "ê", "?": "é" },
  i: { "?": "í" },
  o: { "?!": "ô", "!?": "õ", "?": "ó" },
  u: { "?": "ú" },
  c: { "!": "ç" },
};

function withCase(character, uppercase) {
  return uppercase ? character.toUpperCase() : character;
}

function encrypt(text) {
  let result = "";
  for (const character of text) {
    const suffix = accentSuffix[character];
    if (suffix) {
      const uppercase = character === character.toUpperCase();
      const base = character.normalize("NFD")[0];
      result += (plainToCipher[withCase(base, uppercase)] ?? character) + suffix;
    } else {
      result += plainToCipher[character] ?? digitToCipher[character] ?? punctuationToCipher[character] ?? character;
    }
  }
  return result;
}

function decrypt(text) {
  const characters = Array.from(text);
  let result = "";

  // Percorre da esquerda para a direita e tenta consumir primeiro os sufixos de dois sinais.
  for (let index = 0; index < characters.length; index += 1) {
    const encoded = characters[index];
    const base = cipherToPlain[encoded];
    const lowerBase = base?.toLowerCase();
    if (base && accentsByBaseAndSuffix[lowerBase]) {
      const suffix = characters.slice(index + 1, index + 3).join("");
      const longAccent = ["?!", "!?"].find((candidate) => suffix.startsWith(candidate) && accentsByBaseAndSuffix[lowerBase][candidate]);
      const shortAccent = characters[index + 1] && accentsByBaseAndSuffix[lowerBase][characters[index + 1]] ? characters[index + 1] : null;
      const matchedSuffix = longAccent ?? shortAccent;
      if (matchedSuffix) {
        const accent = accentsByBaseAndSuffix[lowerBase][matchedSuffix];
        result += withCase(accent, base === base.toUpperCase());
        index += matchedSuffix.length;
        continue;
      }
    }

    result += cipherToPlain[encoded] ?? cipherToDigit[encoded] ?? cipherToPunctuation[encoded] ?? encoded;
  }
  return result;
}

function transformText(text, mode) {
  return mode === "encrypt" ? encrypt(text) : decrypt(text);
}

const input = document.querySelector("#message-input");
const inputLabel = document.querySelector("#input-label");
const charCount = document.querySelector("#char-count");
const transformButton = document.querySelector("#transform-button");
const transformLabel = document.querySelector("#transform-label");
const resultText = document.querySelector("#result-text");
const resultPlaceholder = document.querySelector("#result-placeholder");
const resultState = document.querySelector("#result-state");
const resultLength = document.querySelector("#result-length");
const copyButton = document.querySelector("#copy-button");
const statusMessage = document.querySelector("#status-message");
const modeButtons = Array.from(document.querySelectorAll(".mode-button"));
let mode = "decrypt";
let hasResult = false;

function updateCharacterCount() {
  const length = Array.from(input.value).length;
  charCount.textContent = `${length} ${length === 1 ? "carácter" : "caracteres"}`;
}

function setStatus(message = "", kind = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message${kind ? ` ${kind}` : ""}`;
}

function setMode(nextMode) {
  mode = nextMode;
  const decrypting = mode === "decrypt";
  modeButtons.forEach((button) => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  inputLabel.textContent = decrypting ? "MENSAGEM CIFRADA" : "MENSAGEM ORIGINAL";
  input.placeholder = decrypting ? "Cola aqui a mensagem que recebeste…" : "Escreve a mensagem que queres proteger…";
  transformLabel.textContent = decrypting ? "Decifrar mensagem" : "Cifrar mensagem";
  setStatus();
}

function clearResult() {
  resultText.textContent = "";
  resultText.hidden = true;
  resultPlaceholder.hidden = false;
  resultState.classList.remove("ready");
  resultState.lastChild.textContent = " À ESPERA";
  resultLength.textContent = "SEM RESULTADO";
  copyButton.disabled = true;
  hasResult = false;
}

function runTransform() {
  if (!input.value.length) {
    clearResult();
    setStatus("Escreve ou cola uma mensagem para começar.", "error");
    input.focus();
    return;
  }
  const transformed = transformText(input.value, mode);
  resultText.textContent = transformed;
  resultText.hidden = false;
  resultPlaceholder.hidden = true;
  resultState.classList.add("ready");
  resultState.lastChild.textContent = " PRONTO";
  const length = Array.from(transformed).length;
  resultLength.textContent = `${length} ${length === 1 ? "CARÁCTER" : "CARACTERES"}`;
  copyButton.disabled = false;
  hasResult = true;
  setStatus(mode === "decrypt" ? "Mensagem decifrada com sucesso." : "Mensagem cifrada com sucesso.", "success");
}

async function copyResult() {
  if (!hasResult) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(resultText.textContent);
    } else {
      const temporary = document.createElement("textarea");
      temporary.value = resultText.textContent;
      temporary.setAttribute("readonly", "");
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.append(temporary);
      temporary.select();
      const copied = document.execCommand("copy");
      temporary.remove();
      if (!copied) throw new Error("A cópia não foi autorizada pelo navegador.");
    }
    copyButton.innerHTML = '<span aria-hidden="true">✓</span> Copiado';
    setStatus("Resultado copiado para a área de transferência.", "success");
    window.setTimeout(() => { copyButton.innerHTML = '<span aria-hidden="true">▢</span> Copiar'; }, 1600);
  } catch {
    setStatus("Não foi possível copiar. Seleciona o resultado e copia-o manualmente.", "error");
  }
}

modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
input.addEventListener("input", () => { updateCharacterCount(); setStatus(); });
transformButton.addEventListener("click", runTransform);
copyButton.addEventListener("click", copyResult);
document.querySelector("#example-button").addEventListener("click", () => {
  input.value = mode === "decrypt" ? "Rpr?]" : "Olá!";
  updateCharacterCount();
  clearResult();
  setStatus(mode === "decrypt" ? "Exemplo carregado. Carrega em Decifrar mensagem." : "Exemplo carregado. Carrega em Cifrar mensagem.");
  input.focus();
});
document.querySelector("#clear-button")?.addEventListener("click", () => {
  input.value = "";
  updateCharacterCount();
  clearResult();
  setStatus("Campos limpos.");
  input.focus();
});
input.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") runTransform();
});

updateCharacterCount();
