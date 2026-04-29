import { useState, useEffect, useRef } from "react";

export const useAuthImage = (apiUrl) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const activeBlobRef = useRef(null); // the blob currently shown in <img>

  useEffect(() => {
    if (!apiUrl) {
      // Clean up and clear
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
        activeBlobRef.current = null;
      }
      setBlobUrl(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const token = localStorage.getItem("token");

    fetch(apiUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "default", // always fetch fresh — we're using auth headers anyway
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;

        const newUrl = URL.createObjectURL(blob);

        // Revoke the OLD blob only AFTER the new one is ready
        if (activeBlobRef.current) {
          URL.revokeObjectURL(activeBlobRef.current);
        }
        activeBlobRef.current = newUrl;
        setBlobUrl(newUrl);
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn("useAuthImage:", err.message);
          setBlobUrl(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      // Mark cancelled but DON'T revoke — the blob may still be displayed
      cancelled = true;
    };
  }, [apiUrl]);

  // Revoke only on true unmount
  useEffect(() => {
    return () => {
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
        activeBlobRef.current = null;
      }
    };
  }, []);

  return { blobUrl, loading };
};