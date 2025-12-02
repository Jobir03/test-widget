import { useEffect, useState, useRef } from "react";
import { Calendar as CalIcon, X } from "lucide-react";
import "./ScheduleVisitForm.css";
import { scheduleService, type Branch } from "../../services/chat/schedule";
import type { SchedulePayload } from "../../services/chat/types";
import { authService } from "../../services/chat/auth";

interface ScheduleVisitFormProps {
  widgetKey: string;
  onClose?: () => void;
  onSubmitSchedule: (payload: SchedulePayload) => Promise<void> | void;
}

export default function ScheduleVisitForm({
  widgetKey,
  onClose,
  onSubmitSchedule,
}: ScheduleVisitFormProps) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const userDataLoadedRef = useRef(false);
  const [userData, setUserData] = useState<
    import("../../services/chat/auth").UserData | null
  >(null);

  // Load user data when form opens (only once per mount)
  useEffect(() => {
    // Prevent multiple API calls
    if (userDataLoadedRef.current) {
      return;
    }

    let isActive = true;
    const loadUserData = async () => {
      try {
        userDataLoadedRef.current = true;
        const fetchedUserData = await authService.getUser();
        if (isActive && fetchedUserData) {
          setUserData(fetchedUserData);
          // Set name from firstName and lastName
          const fullName = [fetchedUserData.firstName, fetchedUserData.lastName]
            .filter(Boolean)
            .join(" ");
          if (fullName) {
            setName(fullName);
          }
          // Set contact from userData (contact field or fallback to email)
          if (fetchedUserData.contact) {
            setContact(fetchedUserData.contact);
          } else if (fetchedUserData.email) {
            setContact(fetchedUserData.email);
          }
        }
      } catch (e) {
        console.error("Failed to load user data:", e);
        userDataLoadedRef.current = false; // Allow retry on error
      }
    };

    loadUserData();
    return () => {
      isActive = false;
      // Reset ref when component unmounts so it can load again if remounted
      userDataLoadedRef.current = false;
    };
  }, []); // Empty deps - only run once on mount

  useEffect(() => {
    let isActive = true;
    const loadBranches = async () => {
      setLoadingBranches(true);
      try {
        const res = await scheduleService.getBranches(widgetKey);
        if (isActive) {
          setBranches(res.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isActive) {
          setLoadingBranches(false);
        }
      }
    };

    loadBranches();
    return () => {
      isActive = false;
    };
  }, [widgetKey]);

  const handleSubmit = async () => {
    // If no branches available, allow submission without branchId
    const requiresBranch = branches.length > 0;
    if (
      !name ||
      !contact ||
      !date ||
      !time ||
      (requiresBranch && !selectedBranchId)
    ) {
      alert("Iltimos, barcha maydonlarni to'ldiring!");
      return;
    }

    // Product is optional, so we don't require it
    try {
      setSubmitting(true);

      const isoDate = new Date(date);
      const [hours, minutesPart] = time.split(":");
      const minutes = minutesPart?.slice(0, 2) || "00";
      isoDate.setHours(Number(hours), Number(minutes), 0, 0);

      // Split name into firstName and lastName
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      await onSubmitSchedule({
        branchId: selectedBranchId || "", // Empty if no branches available
        productId: "", // Product selection removed
        bookedTime: isoDate.toISOString(),
        firstName,
        lastName,
        contact,
      });

      if (onClose) {
        onClose();
      }
    } catch (e) {
      console.error(e);
      alert(`Failed to schedule visit: ${e}`);
    } finally {
      setSubmitting(false);
    }
  };

  const times = [
    "9:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "1:00 PM",
    "2:00 PM",
    "3:00 PM",
    "4:00 PM",
    "5:00 PM",
    "6:00 PM",
  ];

  // Format date to YYYY-MM-DD for input type="date"
  const formatDateForInput = (date: Date | null): string => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Get today's date in YYYY-MM-DD format for min attribute
  const getTodayDate = (): string => {
    const today = new Date();
    return formatDateForInput(today);
  };

  // Handle date input change
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      const selectedDate = new Date(value);
      // Check if it's Sunday (day 0)
      if (selectedDate.getDay() === 0) {
        alert("Yakshanba kunini tanlash mumkin emas!");
        return;
      }
      setDate(selectedDate);
    } else {
      setDate(null);
    }
  };

  return (
    <>
      <div className="schedule-container fcw">
        <div className="schedule-card fcw">
          {onClose && (
            <button
              onClick={onClose}
              className="schedule-close-button"
              aria-label="Close schedule form"
              title="Close"
            >
              <X size={20} />
            </button>
          )}
          <div className={`schedule-form ${onClose ? "has-close-button" : ""}`}>
            <div className="schedule-row">
              <div className="schedule-form-group">
                <label className="schedule-label">Name</label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="schedule-input"
                />
              </div>

              <div className="schedule-form-group">
                <label className="schedule-label">Email or Phone</label>
                <input
                  type="text"
                  placeholder="Enter your email or phone"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="schedule-input"
                />
              </div>
            </div>

            <div className="schedule-form-group">
              <label className="schedule-label">
                {branches.length > 0 ? "Branch" : "Address"}
              </label>
              {branches.length > 0 ? (
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="schedule-select"
                  disabled={loadingBranches}
                >
                  <option value="">
                    {loadingBranches
                      ? "Loading branches..."
                      : "Choose a branch"}
                  </option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} - (address: {branch.address})
                    </option>
                  ))}
                </select>
              ) : !loadingBranches && userData?.widget?.company ? (
                <div className="schedule-company-info">
                  <div className="schedule-company-location">
                    {userData.widget.company.city &&
                    userData.widget.company.country
                      ? `${userData.widget.company.city}, ${userData.widget.company.country}`
                      : userData.widget.company.city ||
                        userData.widget.company.country ||
                        "Location not available"}
                  </div>
                </div>
              ) : (
                <div className="schedule-company-info">
                  <div className="schedule-company-location">
                    {loadingBranches ? "Loading..." : "No branches available"}
                  </div>
                </div>
              )}
            </div>

            <div className="schedule-row">
              <div className="schedule-form-group">
                <label className="schedule-label">Select Date</label>
                <input
                  type="date"
                  value={formatDateForInput(date)}
                  onChange={handleDateChange}
                  min={getTodayDate()}
                  className="schedule-input"
                />
              </div>

              <div className="schedule-form-group">
                <label className="schedule-label">Select Time</label>
                <select
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="schedule-select"
                >
                  <option value="">Choose a time</option>
                  {times.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                submitting ||
                !name ||
                !contact ||
                !date ||
                !time ||
                (branches.length > 0 && !selectedBranchId)
              }
              className="schedule-submit-button"
            >
              <CalIcon size={18} />
              {submitting ? "Scheduling..." : "Schedule Visit"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
