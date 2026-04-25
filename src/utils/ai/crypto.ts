/**
 * API Key 加密存储模块
 * 使用 Web Crypto API (AES-GCM) 加密 API Key
 *
 * 加密密钥基于浏览器指纹（origin + userAgent）派生
 * 密文格式：ENC:base64(iv + ciphertext)
 */

const ENCRYPTION_PREFIX = "ENC:";
const IV_LENGTH = 12; // AES-GCM 推荐 IV 长度

/**
 * 从浏览器指纹派生加密密钥
 */
async function deriveKey(): Promise<CryptoKey> {
  const fingerprint = `${location.origin}|${navigator.userAgent}|mpe-ai-key`;
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(fingerprint),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("mpe-ai-key-salt-v1"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * 加密 API Key
 * @returns 加密后的字符串，格式为 "ENC:base64(...)"
 */
export async function encryptApiKey(plainKey: string): Promise<string> {
  if (!plainKey) return "";

  try {
    const key = await deriveKey();
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoder = new TextEncoder();

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(plainKey),
    );

    // 将 IV 和密文拼接后 base64 编码
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return ENCRYPTION_PREFIX + btoa(String.fromCharCode(...combined));
  } catch (err) {
    console.error("[AI Crypto] 加密失败:", err);
    // 加密失败时返回原文（降级）
    return plainKey;
  }
}

/**
 * 解密 API Key
 * @returns 解密后的明文 Key
 */
export async function decryptApiKey(encryptedKey: string): Promise<string> {
  if (!encryptedKey) return "";

  // 如果不是加密格式，直接返回（兼容旧版明文）
  if (!isEncryptedKey(encryptedKey)) {
    return encryptedKey;
  }

  try {
    const key = await deriveKey();
    const base64Data = encryptedKey.slice(ENCRYPTION_PREFIX.length);
    const combined = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext,
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error("[AI Crypto] 解密失败:", err);
    // 解密失败返回空，避免泄露密文
    return "";
  }
}

/**
 * 检测是否为加密格式的 Key
 */
export function isEncryptedKey(key: string): boolean {
  return key.startsWith(ENCRYPTION_PREFIX);
}

/**
 * 迁移旧版明文 Key 为加密格式
 * @returns 如果已是加密格式则原样返回，否则返回加密后的结果
 */
export async function migrateApiKey(key: string): Promise<string> {
  if (!key || isEncryptedKey(key)) return key;
  return encryptApiKey(key);
}
