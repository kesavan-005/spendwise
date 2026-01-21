import { useRef, useState } from "react";

export function useToast() {
  const timerRef = useRef(null);

  const [toast, setToast] = useState({
    message: "",
    type: "success",
  });

  function showToast(message, type = "success") {
    setToast({ message, type });

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      setToast({ message: "", type: "success" });
    }, 2200);
  }

  function clearToast() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message: "", type: "success" });
  }

  return { toast, showToast, clearToast };
}
