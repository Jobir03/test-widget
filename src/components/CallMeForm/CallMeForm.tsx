import { useEffect, useState, useRef } from "react";
import { Phone, X } from "lucide-react";
import "./CallMeForm.css";
import type { CallRequestPayload } from "../../services/chat/types";
import { authService } from "../../services/chat/auth";

interface CallMeFormProps {
  onClose?: () => void;
  onSubmitCallRequest: (payload: CallRequestPayload) => Promise<void> | void;
}

export default function CallMeForm({
  onClose,
  onSubmitCallRequest,
}: CallMeFormProps) {
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const userDataLoadedRef = useRef(false);

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
          // Set name from firstName and lastName
          const fullName = [fetchedUserData.firstName, fetchedUserData.lastName]
            .filter(Boolean)
            .join(" ");
          if (fullName) {
            setName(fullName);
          }
          // Set phone from contact field (if it's a phone number) or leave empty
          if (fetchedUserData.contact) {
            // Check if contact is a phone number (starts with + or contains only digits)
            const isPhoneNumber =
              fetchedUserData.contact.startsWith("+") ||
              /^\d+$/.test(fetchedUserData.contact.replace(/\s/g, ""));
            if (isPhoneNumber) {
              setPhoneNumber(fetchedUserData.contact);
            }
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

  const handleSubmit = async () => {
    if (!name || !phoneNumber) {
      alert("Please fill in all fields!");
      return;
    }

    try {
      setSubmitting(true);

      await onSubmitCallRequest({
        name: name.trim(),
        phoneNumber: phoneNumber.trim(),
      });

      if (onClose) {
        onClose();
      }
    } catch (e) {
      console.error(e);
      alert(`Failed to submit call request: ${e}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="call-me-container fcw">
        <div className="call-me-card fcw">
          {onClose && (
            <button
              onClick={onClose}
              className="call-me-close-button"
              aria-label="Close call me form"
              title="Close"
            >
              <X size={20} />
            </button>
          )}
          <div className={`call-me-form ${onClose ? "has-close-button" : ""}`}>
            <div className="call-me-row">
              <div className="call-me-form-group">
                <label className="call-me-label">Name</label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="call-me-input"
                />
              </div>

              <div className="call-me-form-group">
                <label className="call-me-label">Phone Number</label>
                <input
                  type="tel"
                  placeholder="Enter your phone number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="call-me-input"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !name || !phoneNumber}
              className="call-me-submit-button"
            >
              <Phone size={18} />
              {submitting ? "Submitting..." : "Request Call"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
