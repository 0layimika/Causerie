export class BrowserSpeechLayer {
  constructor({ onTranscript, onEnd, onError, onVoicesChanged } = {}) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.supported = Boolean(SpeechRecognition);
    this.listening = false;
    this.onTranscript = onTranscript;
    this.onEnd = onEnd;
    this.onError = onError;
    this.onVoicesChanged = onVoicesChanged;
    this.selectedVoiceURI = '';
    this.recognition = this.supported ? new SpeechRecognition() : null;

    if (this.recognition) {
      this.recognition.lang = 'fr-FR';
      this.recognition.interimResults = true;
      this.recognition.continuous = false;
      this.recognition.onresult = (event) => this.handleResult(event);
      this.recognition.onerror = (event) => {
        this.listening = false;
        this.onError?.(event.error || 'speech_error');
      };
      this.recognition.onend = () => {
        this.listening = false;
        this.onEnd?.();
      };
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => this.onVoicesChanged?.(this.getVoices());
      queueMicrotask(() => this.onVoicesChanged?.(this.getVoices()));
    }
  }

  async start() {
    const permission = await this.requestMicPermission();
    if (!permission.ok) {
      this.onError?.(permission.reason);
      return false;
    }

    if (!this.recognition) {
      this.onError?.('speech_recognition_unavailable');
      return false;
    }

    if (this.listening) return true;
    this.listening = true;
    try {
      this.recognition.start();
      return true;
    } catch (error) {
      this.listening = false;
      this.onError?.(error?.name || 'speech_start_failed');
      return false;
    }
  }

  stop() {
    if (!this.recognition || !this.listening) return;
    this.recognition.stop();
  }

  speak(text, { onStart, onEnd } = {}) {
    if (!('speechSynthesis' in window)) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    const selectedVoice = this.getVoices().find((voice) => voice.voiceURI === this.selectedVoiceURI);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang || 'fr-FR';
    }
    utterance.rate = 0.92;
    utterance.pitch = 1.02;
    utterance.onstart = onStart;
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
    window.speechSynthesis.speak(utterance);
  }

  bargeIn() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  setVoice(voiceURI) {
    this.selectedVoiceURI = voiceURI || '';
  }

  getVoices() {
    if (!('speechSynthesis' in window)) return [];
    const voices = window.speechSynthesis.getVoices();
    const frenchVoices = voices.filter((voice) => voice.lang?.toLowerCase().startsWith('fr'));
    return frenchVoices.length ? frenchVoices : voices;
  }

  async requestMicPermission() {
    if (!window.isSecureContext) {
      return { ok: false, reason: 'insecure_context' };
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      return { ok: false, reason: 'get_user_media_unavailable' };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error?.name || 'mic_permission_denied' };
    }
  }

  handleResult(event) {
    let transcript = '';
    let confidence = 0.8;
    let final = false;

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      transcript += result[0].transcript;
      confidence = result[0].confidence || confidence;
      final = final || result.isFinal;
    }

    this.onTranscript?.({ text: transcript.trim(), confidence, final });
  }
}
