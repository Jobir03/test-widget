import { useEffect, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { Calendar as CalIcon } from "lucide-react";
import "./ScheduleVisitForm.css";
import { scheduleService, type Branch } from "../../services/chat/schedule";

interface ScheduleVisitFormProps {
  widgetKey: string;
  onClose?: () => void;
}

const MOCK_PRODUCT = {
  id: "ab6c4cca-8d3b-4e0b-bc6b-cd2ae0c06f95",
  name: "2' 2 x 3' 11 Pirate Whimsy Kids Runner Rug",
};

export default function ScheduleVisitForm({
  widgetKey,
  onClose,
}: ScheduleVisitFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(MOCK_PRODUCT.id);
  const [submitting, setSubmitting] = useState(false);

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
    if (!name || !email || !date || !time || !selectedBranchId) {
      alert("Iltimos, barcha maydonlarni to'ldiring!");
      return;
    }
    try {
      setSubmitting(true);

      const isoDate = new Date(date);
      const [hours, minutesPart] = time.split(":");
      const minutes = minutesPart?.slice(0, 2) || "00";
      isoDate.setHours(Number(hours), Number(minutes), 0, 0);

      await scheduleService.createSchedule(widgetKey, {
        branchId: selectedBranchId,
        productId: selectedProductId,
        bookedTime: isoDate.toISOString(),
        firstName: name,
        lastName: "",
        email,
      });

      alert("Tashrif muvaffaqiyatli rejalashtirildi!");
      if (onClose) {
        onClose();
      }
    } catch (e) {
      console.error(e);
      alert(
        "Tashrifni rejalashtirishda xatolik yuz berdi. Iltimos, qayta urinib ko'ring."
      );
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

  const isWeekend = (date: Date) => {
    return date.getDay() === 0;
  };

  return (
    <>
      <div className="schedule-container fcw">
        <div className="schedule-card fcw">
          <div className="schedule-form">
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="schedule-input"
                />
              </div>
            </div>

            <div className="schedule-row">
              <div className="schedule-form-group">
                <label className="schedule-label">Branch</label>
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
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="schedule-form-group">
                <label className="schedule-label">Product</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="schedule-select"
                >
                  <option value={MOCK_PRODUCT.id}>{MOCK_PRODUCT.name}</option>
                </select>
              </div>
            </div>

            <div className="schedule-form-group">
              <label className="schedule-label">Select Date</label>
              <div className="schedule-calendar-wrapper">
                <Calendar
                  onChange={(value) => {
                    if (value) {
                      const selectedDate = Array.isArray(value)
                        ? value[0]
                        : value;
                      setDate(selectedDate);
                    }
                  }}
                  value={date}
                  minDate={new Date()}
                  tileDisabled={({ date }) => isWeekend(date)}
                  locale="en-US"
                  formatShortWeekday={(_locale, date) =>
                    ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][date.getDay()]
                  }
                />
              </div>
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

            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                submitting ||
                !name ||
                !email ||
                !date ||
                !time ||
                !selectedBranchId ||
                !selectedProductId
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
