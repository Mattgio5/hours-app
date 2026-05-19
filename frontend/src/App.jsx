import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import TimeEntry from "./pages/TimeEntry";
import TimeOff from "./pages/TimeOff";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/time-entry" element={<TimeEntry />} />
        <Route path="/time-off" element={<TimeOff />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}
