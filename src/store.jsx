import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
const Context = createContext(null);
export function Provider({ children }) {
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [auth, setAuth] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(null),
    [branchId, setBranch] = useState(
      Number(localStorage.getItem("la-branch")) || 1,
    ),
    [page, setPage] = useState(location.hash.slice(1) || "dashboard"),
    [posTable, setPosTable] = useState(null),
    [offline, setOffline] = useState(false);
  const branchRef = useRef(branchId);
  branchRef.current = branchId;
  const notify = useCallback(
    (message, type = "success") => setToast({ message, type, id: Date.now() }),
    [],
  );
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const api = useCallback(async (path, options = {}) => {
    let response;
    try {
      response = await fetch("/api" + path, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "X-Branch-Id": String(branchRef.current),
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    } catch {
      throw new Error("Không kết nối được máy chủ. Vui lòng kiểm tra kết nối.");
    }
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        setAuth(false);
        setData(null);
      }
      throw new Error(result.error || "Có lỗi xảy ra.");
    }
    return result;
  }, []);
  const refresh = useCallback(
    async (silent = false) => {
      const requested = branchRef.current;
      try {
        const result = await api("/bootstrap");
        if (requested !== branchRef.current) return;
        setData(result);
        setAuth(true);
        setError("");
        setOffline(false);
      } catch (e) {
        if (!silent) setError(e.message);
        else setOffline(true);
      } finally {
        setLoading(false);
      }
    },
    [api],
  );
  useEffect(() => {
    setLoading(true);
    setData(null);
    refresh();
  }, [branchId, refresh]);
  useEffect(() => {
    if (!auth) return;
    const timer = setInterval(() => refresh(true), 15000);
    return () => clearInterval(timer);
  }, [auth, refresh]);
  useEffect(() => {
    const onHash = () => setPage(location.hash.slice(1) || "dashboard");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const navigate = (next) => {
    location.hash = next;
    setPage(next);
  };
  const switchBranch = (id) => {
    localStorage.setItem("la-branch", id);
    setPosTable(null);
    setBranch(id);
  };
  const login = async (email, password) => {
    const result = await api("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    const next = result.user.branchId || 1;
    branchRef.current = next;
    localStorage.setItem("la-branch", next);
    setBranch(next);
    setAuth(true);
    await refresh();
    navigate(result.user.role === "kitchen" ? "kitchen" : "dashboard");
  };
  const logout = async () => {
    await api("/auth/logout", { method: "POST", body: {} });
    setAuth(false);
    setData(null);
  };
  const mutate = async (
    path,
    body,
    method = "POST",
    message = "Đã lưu thay đổi",
  ) => {
    const result = await api(path, { method, body });
    await refresh(true);
    notify(message);
    return result;
  };
  return (
    <Context.Provider
      value={{
        data,
        loading,
        auth,
        error,
        toast,
        notify,
        api,
        refresh,
        mutate,
        login,
        logout,
        page,
        navigate,
        branchId,
        switchBranch,
        posTable,
        setPosTable,
        offline,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useApp = () => useContext(Context);
