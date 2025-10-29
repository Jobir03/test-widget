import { useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { Calendar as CalIcon } from "lucide-react";
import "./ScheduleVisitForm.css";

export default function ScheduleVisitForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState("");

  const handleSubmit = () => {
    if (!name || !email || !date || !time) {
      alert("Iltimos, barcha maydonlarni to'ldiring!");
      return;
    }
    alert(
      `Tashrif rejalashtirildi!\nIsm: ${name}\nEmail: ${email}\nSana: ${date.toLocaleDateString()}\nVaqt: ${time}`
    );
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
              disabled={!name || !email || !date || !time}
              className="schedule-submit-button"
            >
              <CalIcon size={18} />
              Schedule Visit
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
