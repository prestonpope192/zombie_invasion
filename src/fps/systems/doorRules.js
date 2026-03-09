export function canInteractWithDoor(distance, interactRange = 2.2) {
  return Number(distance) <= Number(interactRange);
}

export function nextDoorState(isOpen) {
  return !Boolean(isOpen);
}
