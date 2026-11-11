import React, { createContext, useContext } from "react";

/**
 * True on screens pushed over the tabs (modules opened from More, the
 * account), so ScreenFrame shows a back button. Its own file so ScreenFrame
 * doesn't import the navigator, which imports every module's screen.
 */
const PushedContext = createContext(false);
export const useIsPushed = () => useContext(PushedContext);

export function pushed(Screen: React.ComponentType) {
  return function Pushed() {
    return (
      <PushedContext.Provider value>
        <Screen />
      </PushedContext.Provider>
    );
  };
}
