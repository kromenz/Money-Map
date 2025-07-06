import React, { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    axios
      .get("http://localhost:5000/expenses")
      .then((res) => setExpenses(res.data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div>
      <h1>MoneyMap - Expense Tracker</h1>
      <ul>
        {expenses.map((expense) => (
          <li key={expense.id}>
            {expense.description} - ${expense.amount} [{expense.category}]
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
