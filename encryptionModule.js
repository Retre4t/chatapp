// encryptionModule.js
const { SignalKeyHelper, SignalProtocol, SignalCrypto } = require('libsignal-protocol');
const { StringEncoder, StringDecoder } = require('libsignal-protocol/dist/Util');
const { MemoryStore, SessionBuilder, SessionCipher, SessionCipherBuilder } = require('libsignal-protocol/dist/SessionStore');

const store = new MemoryStore();

function initializeSession(senderKey, receiverAddress) {
  const address = new SignalProtocol.SignalProtocolAddress(receiverAddress, 1);
  const sessionBuilder = new SessionBuilder(store, address);

  // Sender key (this should be unique per user)
  const senderKeyHelper = new SignalKeyHelper();
  const senderKeyRecord = senderKeyHelper.generateSenderKeyRecord();

  sessionBuilder.processPreKey(senderKeyRecord);

  return sessionBuilder.getSession();
}

function encryptMessage(session, message) {
  const cipher = new SessionCipherBuilder(store, session.address).create();
  return cipher.encrypt(StringEncoder.toArrayBuffer(message));
}

function decryptMessage(session, ciphertext) {
  const cipher = new SessionCipherBuilder(store, session.address).create();
  const plaintext = cipher.decrypt(ciphertext, 'binary');
  return StringDecoder.decode(plaintext);
}

module.exports = {
  initializeSession,
  encryptMessage,
  decryptMessage,
};
