import { nowIso, uid } from './utils.js';

export function createTelemetry(initial = []) {
  const events = [...initial];
  return {
    events,
    emit(type, props = {}) {
      const event = { id: uid('evt'), type, at: nowIso(), ...props };
      events.push(event);
      return event;
    },
    count(type) {
      return events.filter((event) => event.type === type).length;
    },
    latest(type) {
      return [...events].reverse().find((event) => event.type === type);
    }
  };
}
