import { useState, useEffect } from "react";
import axios from "axios";

/**
 * Returns { complete, missing, loading }
 * `complete` is true only when all required fields are filled.
 * `missing`  is an array of human-readable field names still needed.
 */
export function useProfileComplete() {
  const [complete, setComplete] = useState(null); // null = not checked yet
  const [missing, setMissing] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const token = localStorage.getItem("token");
        const { data } = await axios.get("/api/employees/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!data.success) {
          setComplete(false);
          return;
        }

        const emp = data.employee;
        const role = emp.role;

        // Admins are always "complete"
        if (["owner", "superadmin"].includes(role)) {
          setComplete(true);
          setMissing([]);
          return;
        }

        const gaps = [];
        if (emp.bank?.bankName?.trim()) gaps.push("Bank name");
        if (emp.bank?.accountName?.trim()) gaps.push("Account name");
        if (emp.bank?.accountNumber?.trim())
          gaps.push("IBAN / Account number");
        if (emp.idCard?.front?.fileId) gaps.push("ID card — front side");
        if (emp.idCard?.back?.fileId) gaps.push("ID card — back side");
        if (emp.emergencyContact?.name?.trim())
          gaps.push("Emergency contact name");
        if (emp.emergencyContact?.phone?.trim())
          gaps.push("Emergency contact phone");

        setMissing(gaps);
        setComplete(gaps.length === 0);
      } catch {
        setComplete(false);
      } finally {
        setLoading(false);
      }
    };

    check();
  }, []);

  return { complete, missing, loading };
}
