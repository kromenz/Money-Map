# MoneyMap

MoneyMap is an expense management application developed with **React** and **Prisma**, helping you monitor and organize your finances in a simple and intuitive way.

## 📈 Features

- Add, edit, and delete expenses
- View expense history
- Categorize expenses
- Interactive reports and charts
- Database integration via **Prisma**
- Responsive and user-friendly interface with **React**

## 🛠 Technologies Used

- **Frontend**: React, NextJS, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: PostgreSQL (Docker)
- **ORM**: Prisma
- **Containerization**: Docker

## 🛠 Installation and Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/kromenz/Money-Map.git
   cd moneymap
   ```

2. Configure the **.env** file:

   ```env
   DATABASE_URL="postgresql://user:password@db:5432/moneymap"
   ```

3. Start Docker and services:

   ```bash
   docker-compose up -d
   ```

4. Run Prisma migrations:

   ```bash
   docker-compose exec api npx prisma migrate dev
   ```

5. Access the application at `http://localhost:3000` and start managing your finances!

## 📊 Usage

Access the application at `http://localhost:3000` and start managing your finances!

## 🌟 Contribution

Feel free to contribute with improvements and new features. Just open an _issue_ or _pull request_ in the repository!

## ✨ License

This project is distributed under the MIT license.

---

💰 **MoneyMap - Your path to an organized financial life!**
