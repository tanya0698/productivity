import React from "react";
import Sheet from "./Sheet";
import { Button } from "./Field";
import type { AvatarSource } from "../shared/auth/avatar";

/** Choose, take or remove a profile picture. */
export default function AvatarActions({
  open,
  canRemove,
  onClose,
  onPick,
  onRemove,
}: {
  open: boolean;
  canRemove: boolean;
  onClose: () => void;
  onPick: (source: AvatarSource) => void;
  onRemove: () => void;
}) {
  return (
    <Sheet open={open} title="Profile picture" onClose={onClose}>
      <Button kind="primary" label="Choose a photo" onPress={() => onPick("library")} />
      <Button label="Take a photo" onPress={() => onPick("camera")} />
      {canRemove ? <Button kind="danger" label="Remove picture" onPress={onRemove} /> : null}
      <Button label="Cancel" onPress={onClose} />
    </Sheet>
  );
}
