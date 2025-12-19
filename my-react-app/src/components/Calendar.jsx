import React from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

export default function Calendar({ selected, onSelect }) {
    return (
        <div className="w-full flex justify-center">
            <div className="calendar-box">
                <DayPicker
                    mode="single"
                    selected={selected}
                    onSelect={onSelect}
                    className="custom-calendar"
                />
            </div>
        </div>

    );
}
