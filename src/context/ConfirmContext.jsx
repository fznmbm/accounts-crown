import { createContext, useContext, useState, useCallback } from "react";
import ConfirmModal from "../components/ConfirmModal";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const showConfirm = useCallback(
    ({ title, message, type = "danger", confirmLabel = "Confirm" }) =>
      new Promise((resolve) => {
        setState({
          title,
          message,
          type,
          confirmLabel,
          onConfirm: () => {
            setState(null);
            resolve(true);
          },
          onCancel: () => {
            setState(null);
            resolve(false);
          },
        });
      }),
    [],
  );

  return (
    <ConfirmContext.Provider value={showConfirm}>
      {children}
      {state && <ConfirmModal {...state} />}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ctx;
};
