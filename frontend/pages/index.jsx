import React, { useEffect, useState } from "react";
import axios from "axios";

export default function Home() {
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    axios
      .get("http://localhost:5000/expenses")
      .then((res) => setExpenses(res.data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">
        MoneyMap &#8211; Expense Tracker
      </h1>
      <ul className="list-disc pl-5">
        {expenses.map((expense) => (
          <li key={expense.id} className="mb-2">
            <span className="font-semibold">{expense.description}</span> – $
            {expense.amount}{" "}
            <span className="text-sm text-gray-500">[{expense.category}]</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
