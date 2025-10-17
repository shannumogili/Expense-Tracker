document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const themeToggle = document.getElementById('theme-icon');
    const navItems = document.querySelectorAll('.main-nav li');
    const contentSections = document.querySelectorAll('.content-section');
    
    // Modal elements
    const transactionModal = document.getElementById('transaction-modal');
    const categoryModal = document.getElementById('category-modal');
    const goalModal = document.getElementById('goal-modal');
    const addTransactionBtn = document.getElementById('add-transaction');
    const addCategoryBtn = document.getElementById('add-category');
    const addGoalBtn = document.getElementById('add-goal');
    const closeModalBtns = document.querySelectorAll('.close-modal');
    
    // Form elements
    const transactionForm = document.getElementById('transaction-form');
    const categoryForm = document.getElementById('category-form');
    const goalForm = document.getElementById('goal-form');
    
    // Chart elements
    let categoryChart, monthlyChart, incomeExpenseChart, trendsChart;
    
    // App state
    let state = {
        transactions: [],
        categories: [
            { id: 1, name: 'Food', budget: 0, icon: 'fa-utensils', color: '#FF6384' },
            { id: 2, name: 'Transportation', budget: 0, icon: 'fa-car', color: '#36A2EB' },
            { id: 3, name: 'Housing', budget: 0, icon: 'fa-home', color: '#FFCE56' },
            { id: 4, name: 'Entertainment', budget: 0, icon: 'fa-film', color: '#4BC0C0' },
            { id: 5, name: 'Shopping', budget: 0, icon: 'fa-shopping-cart', color: '#9966FF' },
            { id: 6, name: 'Income', budget: 0, icon: 'fa-money-bill-wave', color: '#00CC99' }
        ],
        goals: [],
        currentMonth: new Date().getMonth(),
        currentYear: new Date().getFullYear()
    };

    // Notification system
    let notificationId = 0;

    function showNotification(title, message, type = 'info', duration = 5000) {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.id = `notification-${notificationId++}`;

        const iconMap = {
            success: 'fa-check',
            warning: 'fa-exclamation-triangle',
            error: 'fa-times-circle',
            info: 'fa-info-circle'
        };

        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas ${iconMap[type]}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" onclick="hideNotification('${notification.id}')">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(notification);

        // Trigger animation
        setTimeout(() => notification.classList.add('show'), 10);

        // Auto-hide after duration
        if (duration > 0) {
            setTimeout(() => hideNotification(notification.id), duration);
        }

        return notification.id;
    }

    function hideNotification(id) {
        const notification = document.getElementById(id);
        if (notification) {
            notification.classList.add('hide');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }

    // Check budget limits and show alerts
    function checkBudgetAlerts() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Calculate spending by category for current month
        const categorySpending = {};
        state.transactions
            .filter(trans => trans.type === 'expense' &&
                  trans.date.getMonth() === currentMonth &&
                  trans.date.getFullYear() === currentYear)
            .forEach(trans => {
                if (!categorySpending[trans.categoryId]) {
                    categorySpending[trans.categoryId] = 0;
                }
                categorySpending[trans.categoryId] += trans.amount;
            });

        // Check each category for budget exceedance
        state.categories.forEach(category => {
            if (category.name === 'Income') return; // Skip income category

            const spent = categorySpending[category.id] || 0;
            const budget = category.budget;

            if (budget > 0 && spent > budget) {
                const overAmount = spent - budget;
                showNotification(
                    'Budget Exceeded!',
                    `You've exceeded your ${category.name} budget by Rs${overAmount.toFixed(2)}. Consider reviewing your spending.`,
                    'warning',
                    8000
                );
            } else if (budget > 0 && spent >= budget * 0.9) {
                const remaining = budget - spent;
                showNotification(
                    'Budget Alert',
                    `You're close to exceeding your ${category.name} budget. Rs${remaining.toFixed(2)} remaining.`,
                    'warning',
                    6000
                );
            }
        });
    }
    
    // Render dashboard
    function renderDashboard() {
        updateSummaryCards();
        renderRecentTransactions();
    }

    // Initialize the app
    async function init() {
        // Check if user is logged in
        let token = localStorage.getItem('token');

        // Check URL params for token (e.g., after Google OAuth)
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('token');
        if (urlToken) {
            localStorage.setItem('token', urlToken);
            token = urlToken;
            // Clean URL by removing token param
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (!token) {
            // Redirect to login if not logged in
            window.location.href = "login.html";
            return;
        }

        // Fetch user data and display name
        if (token) {
            try {
                const response = await fetch('/user', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const user = await response.json();
                    const welcomeElement = document.getElementById('welcome-message');
                    if (welcomeElement) {
                        welcomeElement.textContent = `Welcome, ${user.name}!`;
                    }
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        }

        await loadData();
        setupEventListeners();
        renderDashboard();
        renderCategories();
        renderTransactionsTable();
        renderCharts();
        setCurrentMonthYear();
        checkBudgetAlerts();
    }
    
    // Load data from server
    async function loadData() {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            // Load transactions
            const transactionsResponse = await fetch('/transactions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (transactionsResponse.ok) {
                state.transactions = await transactionsResponse.json();
                // Convert date strings back to Date objects
                state.transactions.forEach(trans => {
                    trans.date = new Date(trans.date);
                });
            }

            // Load categories
            const categoriesResponse = await fetch('/categories', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (categoriesResponse.ok) {
                const userCategories = await categoriesResponse.json();
                if (userCategories.length > 0) {
                    state.categories = userCategories;
                }
            }

            // Load goals
            const goalsResponse = await fetch('/goals', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (goalsResponse.ok) {
                state.goals = await goalsResponse.json();
                // Convert date strings back to Date objects
                state.goals.forEach(goal => {
                    goal.date = new Date(goal.date);
                });
            }
            // Load loans (NEW)
const loansResponse = await fetch('/loans', { headers: { Authorization: `Bearer ${token}` } });
if (loansResponse.ok) {
  state.loans = await loansResponse.json();
  state.loans.forEach(loan => {
    loan.startDate = new Date(loan.startDate);
    loan.nextDueDate = new Date(loan.nextDueDate);
  });
}
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }
    


    // Save data to server
    async function saveData() {
        // Data is now saved to server via API calls, no need for localStorage
    }
    
    // Set up event listeners
    function setupEventListeners() {
        // Theme toggle
        themeToggle.addEventListener('click', toggleTheme);
        
        // Navigation
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                const section = item.getAttribute('data-section');
                contentSections.forEach(sec => sec.classList.remove('active'));
                document.getElementById(section).classList.add('active');
                
                // Render specific content when section changes
                if (section === 'transactions') {
                    renderTransactionsTable();
                } else if (section === 'budgets') {
                    renderCategories();
                } else if (section === 'reports') {
                    renderCharts();
                } else if (section === 'goals') {
                    renderGoals();
                }
            });
        });
        
        // Modal open buttons
        addTransactionBtn.addEventListener('click', () => openModal('transaction'));
        addCategoryBtn.addEventListener('click', () => openModal('category'));
        addGoalBtn.addEventListener('click', () => openModal('goal'));
        
        // Modal close buttons
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', closeModal);
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                closeModal();
            }
        });
        
        // Form submissions
        transactionForm.addEventListener('submit', handleTransactionSubmit);
        categoryForm.addEventListener('submit', handleCategorySubmit);
        goalForm.addEventListener('submit', handleGoalSubmit);
        
        // Report period navigation
        document.getElementById('prev-month').addEventListener('click', () => {
            if (state.currentMonth === 0) {
                state.currentMonth = 11;
                state.currentYear--;
            } else {
                state.currentMonth--;
            }
            setCurrentMonthYear();
            renderCharts();
        });
        
        document.getElementById('next-month').addEventListener('click', () => {
            if (state.currentMonth === 11) {
                state.currentMonth = 0;
                state.currentYear++;
            } else {
                state.currentMonth++;
            }
            setCurrentMonthYear();
            renderCharts();
        });
        
        // Filter changes
        document.getElementById('transaction-type').addEventListener('change', renderTransactionsTable);
        document.getElementById('transaction-category').addEventListener('change', renderTransactionsTable);
        document.getElementById('transaction-month').addEventListener('change', renderTransactionsTable);

        // Export data
        document.getElementById('export-data').addEventListener('click', exportToExcel);

        // Logout button
        document.getElementById('logout-btn').addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = "login.html";
        });
    }
    
    // Toggle between light and dark theme
    function toggleTheme() {
        const body = document.body;
        if (body.getAttribute('data-theme') === 'dark') {
            body.removeAttribute('data-theme');
            themeToggle.classList.remove('fa-sun');
            themeToggle.classList.add('fa-moon');
        } else {
            body.setAttribute('data-theme', 'dark');
            themeToggle.classList.remove('fa-moon');
            themeToggle.classList.add('fa-sun');
        }
    }
    
    // Open modal
    function openModal(type) {
        closeModal(); // Close any open modal first
        
        if (type === 'transaction') {
            prepareTransactionModal();
            transactionModal.classList.add('active');
        } else if (type === 'category') {
            prepareCategoryModal();
            categoryModal.classList.add('active');
        } else if (type === 'goal') {
            prepareGoalModal();
            goalModal.classList.add('active');
        }
    }
    
    // Close modal
    function closeModal() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }
    
    // Prepare transaction modal
    function prepareTransactionModal() {
        // Set today's date as default
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('trans-date').value = today;
        
        // Populate category dropdown
        const categorySelect = document.getElementById('trans-category');
        categorySelect.innerHTML = '';
        
        state.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categorySelect.appendChild(option);
        });
    }
    
    // Prepare category modal
    function prepareCategoryModal(editing = false, category = null) {
        if (editing && category) {
            document.getElementById('category-name').value = category.name;
            document.getElementById('category-budget').value = category.budget;
            document.getElementById('category-icon').value = category.icon;
        } else {
            document.getElementById('category-name').value = '';
            document.getElementById('category-budget').value = '';
            document.getElementById('category-icon').value = 'fa-utensils';
        }
    }
    
    // Prepare goal modal
    function prepareGoalModal(editing = false, goal = null) {
        const nameLabel = document.querySelector('label[for="goal-name"]');
        const savedLabel = document.querySelector('label[for="goal-saved"]');
        const nameInput = document.getElementById('goal-name');
        const targetInput = document.getElementById('goal-target');
        const savedInput = document.getElementById('goal-saved');
        const dateInput = document.getElementById('goal-date');

        if (editing && goal) {
            // For editing, make non-saved fields read-only and change saved to "Amount to Add"
            nameLabel.textContent = 'Goal Name (Read-only)';
            nameInput.value = goal.name;
            nameInput.disabled = true;

            const targetLabel = document.querySelector('label[for="goal-target"]');
            targetLabel.textContent = 'Target Amount (Read-only)';
            targetInput.value = goal.target;
            targetInput.disabled = true;

            savedLabel.textContent = 'Amount to Add (Rs.)';
            savedInput.value = '';
            savedInput.placeholder = 'Enter amount to add to saved';
            savedInput.required = true;

            const dateLabel = document.querySelector('label[for="goal-date"]');
            dateLabel.textContent = 'Target Date (Read-only)';
            dateInput.value = goal.date.toISOString().split('T')[0];
            dateInput.disabled = true;

            // Store the goal ID in a data attribute for the form
            goalForm.setAttribute('data-editing-goal-id', goal.id);
        } else {
            // Reset for adding new goal
            nameLabel.textContent = 'Goal Name';
            nameInput.value = '';
            nameInput.disabled = false;

            const targetLabel = document.querySelector('label[for="goal-target"]');
            targetLabel.textContent = 'Target Amount (Rs.)';
            targetInput.value = '';
            targetInput.disabled = false;

            savedLabel.textContent = 'Amount Saved (Rs.)';
            savedInput.value = '0';
            savedInput.placeholder = '';
            savedInput.required = true;

            const dateLabel = document.querySelector('label[for="goal-date"]');
            dateLabel.textContent = 'Target Date';
            dateInput.value = '';
            dateInput.disabled = false;

            goalForm.removeAttribute('data-editing-goal-id');
        }
    }
    
    // Handle transaction form submission
    async function handleTransactionSubmit(e) {
        e.preventDefault();

        const type = document.getElementById('trans-type').value;
        const amount = parseFloat(document.getElementById('trans-amount').value);
        const description = document.getElementById('trans-description').value;
        const categoryId = parseInt(document.getElementById('trans-category').value);
        const date = new Date(document.getElementById('trans-date').value);

        const category = state.categories.find(cat => cat.id === categoryId);

        const newTransaction = {
            type,
            amount,
            description,
            category: category.name,
            categoryId,
            date,
            icon: category.icon
        };

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/transactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newTransaction)
            });

            if (response.ok) {
                const savedTransaction = await response.json();
                savedTransaction.date = new Date(savedTransaction.date);
                state.transactions.push(savedTransaction);

                // Update UI
                closeModal();
                updateSummaryCards();
                renderRecentTransactions();
                renderTransactionsTable();
                renderCharts();

                // Check for budget alerts after adding transaction
                checkBudgetAlerts();

                // Reset form
                transactionForm.reset();
            } else {
                alert('Failed to save transaction');
            }
        } catch (error) {
            console.error('Error saving transaction:', error);
            alert('Error saving transaction');
        }
    }
    
    // Handle category form submission
    function handleCategorySubmit(e) {
        e.preventDefault();
        
        const name = document.getElementById('category-name').value;
        const budget = parseFloat(document.getElementById('category-budget').value);
        const icon = document.getElementById('category-icon').value;
        
        // Generate a random color for the category
        const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#00CC99', '#FF9F40'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        const newCategory = {
            id: Date.now(),
            name,
            budget,
            icon,
            color
        };
        
        state.categories.push(newCategory);
        saveData();
        
        // Update UI
        closeModal();
        renderCategories();
        renderCharts();
        
        // Reset form
        categoryForm.reset();
    }
    
    // Handle goal form submission
    function handleGoalSubmit(e) {
        e.preventDefault();
        
        const editingId = goalForm.getAttribute('data-editing-goal-id');
        
        if (editingId) {
            // Editing mode - only add to saved amount
            const goal = state.goals.find(g => g.id == editingId);
            if (!goal) return;
            
            const amountToAdd = parseFloat(document.getElementById('goal-saved').value);
            if (isNaN(amountToAdd) || amountToAdd <= 0) {
                alert('Please enter a valid amount to add.');
                return;
            }
            
            goal.saved += amountToAdd;
            // Ensure saved doesn't exceed target
            if (goal.saved > goal.target) {
                goal.saved = goal.target;
            }
            
            saveData();
            
            // Update UI
            closeModal();
            renderGoals();
            
            // Reset form for next use
            prepareGoalModal();
        } else {
            // Adding new goal
            const name = document.getElementById('goal-name').value;
            const target = parseFloat(document.getElementById('goal-target').value);
            const saved = parseFloat(document.getElementById('goal-saved').value);
            const date = new Date(document.getElementById('goal-date').value);
            
            if (!name || isNaN(target) || target <= 0 || isNaN(saved) || saved < 0) {
                alert('Please fill all fields with valid values.');
                return;
            }
            
            const newGoal = {
                id: Date.now(),
                name,
                target,
                saved,
                date
            };
            
            state.goals.push(newGoal);
            saveData();
            
            // Update UI
            closeModal();
            renderGoals();
            
            // Reset form
            goalForm.reset();
            prepareGoalModal();
        }
    }
    
    // Update summary cards
    function updateSummaryCards() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        // Filter transactions for current month
        const monthlyTransactions = state.transactions.filter(trans => {
            return trans.date.getMonth() === currentMonth && trans.date.getFullYear() === currentYear;
        });
        
        // Calculate totals
        const income = monthlyTransactions
            .filter(trans => trans.type === 'income')
            .reduce((sum, trans) => sum + trans.amount, 0);
        
        const expenses = monthlyTransactions
            .filter(trans => trans.type === 'expense')
            .reduce((sum, trans) => sum + trans.amount, 0);
        
        const balance = income - expenses;
        const savingsRate = income > 0 ? ((income - expenses) / income * 100).toFixed(1) : 0;
        
        // Update DOM
        document.getElementById('total-balance').textContent = `Rs${balance.toFixed(2)}`;
        document.getElementById('monthly-income').textContent = `Rs${income.toFixed(2)}`;
        document.getElementById('monthly-expenses').textContent = `Rs${expenses.toFixed(2)}`;
        document.getElementById('savings-rate').textContent = `${savingsRate}%`;
        
        // Update change indicator
        const changeElement = document.querySelector('#total-balance + .change');
        if (balance > 0) {
            changeElement.classList.add('positive');
            changeElement.classList.remove('negative');
        } else if (balance < 0) {
            changeElement.classList.add('negative');
            changeElement.classList.remove('positive');
        } else {
            changeElement.classList.remove('positive', 'negative');
        }
    }
    
    // Render recent transactions
    function renderRecentTransactions() {
        const container = document.getElementById('recent-transactions');
        container.innerHTML = '';
        
        // Get 5 most recent transactions
        const recentTransactions = [...state.transactions]
            .sort((a, b) => b.date - a.date)
            .slice(0, 5);
        
        if (recentTransactions.length === 0) {
            container.innerHTML = '<p class="no-transactions">No transactions yet. Add your first transaction!</p>';
            return;
        }
        
        recentTransactions.forEach(trans => {
            const transactionEl = document.createElement('div');
            transactionEl.className = 'transaction-item';
            
            const category = state.categories.find(cat => cat.id === trans.categoryId);
            
            transactionEl.innerHTML = `
                <div class="transaction-info">
                    <div class="transaction-icon">
                        <i class="fas ${trans.icon || 'fa-money-bill-wave'}"></i>
                    </div>
                    <div class="transaction-details">
                        <h4>${trans.description}</h4>
                        <p>${category?.name || trans.category} • ${formatDate(trans.date)}</p>
                    </div>
                </div>
                <div class="transaction-amount ${trans.type}">
                    ${trans.type === 'income' ? '+' : '-'}Rs${trans.amount.toFixed(2)}
                </div>
            `;
            
            container.appendChild(transactionEl);
        });
    }
    
    // Render transactions table
    function renderTransactionsTable() {
        const container = document.getElementById('transactions-list');
        container.innerHTML = '';
        
        const typeFilter = document.getElementById('transaction-type').value;
        const categoryFilter = document.getElementById('transaction-category').value;
        const monthFilter = document.getElementById('transaction-month').value;
        
        // Populate category filter
        const categorySelect = document.getElementById('transaction-category');
        if (categorySelect.options.length <= 1) { // Only "All Categories" option
            state.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                categorySelect.appendChild(option);
            });
        }
        
        // Populate month filter
        const monthSelect = document.getElementById('transaction-month');
        if (monthSelect.options.length <= 1) { // Only "All Months" option
            const months = [];
            state.transactions.forEach(trans => {
                const monthYear = `${trans.date.getFullYear()}-${trans.date.getMonth()}`;
                if (!months.includes(monthYear)) {
                    months.push(monthYear);
                    
                    const option = document.createElement('option');
                    option.value = monthYear;
                    option.textContent = `${getMonthName(trans.date.getMonth())} ${trans.date.getFullYear()}`;
                    monthSelect.appendChild(option);
                }
            });
        }
        
        // Filter transactions
        let filteredTransactions = [...state.transactions];
        
        if (typeFilter !== 'all') {
            filteredTransactions = filteredTransactions.filter(trans => trans.type === typeFilter);
        }
        
        if (categoryFilter !== 'all') {
            filteredTransactions = filteredTransactions.filter(trans => trans.categoryId === parseInt(categoryFilter));
        }
        
        if (monthFilter !== 'all') {
            const [year, month] = monthFilter.split('-').map(Number);
            filteredTransactions = filteredTransactions.filter(trans => {
                return trans.date.getFullYear() === year && trans.date.getMonth() === month;
            });
        }
        
        // Sort by date (newest first)
        filteredTransactions.sort((a, b) => b.date - a.date);
        
        if (filteredTransactions.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="6" class="no-transactions">No transactions found matching your filters.</td>
                </tr>
            `;
            return;
        }
        
        filteredTransactions.forEach(trans => {
            const row = document.createElement('tr');
            
            const category = state.categories.find(cat => cat.id === trans.categoryId);
            
            row.innerHTML = `
                <td>${formatDate(trans.date)}</td>
                <td>${trans.description}</td>
                <td>
                    <i class="fas ${trans.icon || 'fa-money-bill-wave'}"></i>
                    ${category?.name || trans.category}
                </td>
                <td>
                    <span class="badge ${trans.type === 'income' ? 'income' : 'expense'}">
                        ${trans.type === 'income' ? 'Income' : 'Expense'}
                    </span>
                </td>
                <td class="${trans.type === 'income' ? 'income' : 'expense'}">
                    ${trans.type === 'income' ? '+' : '-'}Rs${trans.amount.toFixed(2)}
                </td>
                <td class="action-buttons">
                    <button class="action-btn edit-btn" data-id="${trans.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" data-id="${trans.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            container.appendChild(row);
        });
        
        // Add event listeners to action buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.getAttribute('data-id');
                editTransaction(id);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.getAttribute('data-id');
                deleteTransaction(id);
            });
        });
    }
    
    // Edit transaction
    async function editTransaction(id) {
        const transaction = state.transactions.find(trans => trans.id === id);
        if (!transaction) return;

        openModal('transaction');

        // Fill form with transaction data
        document.getElementById('trans-type').value = transaction.type;
        document.getElementById('trans-amount').value = transaction.amount;
        document.getElementById('trans-description').value = transaction.description;
        document.getElementById('trans-category').value = transaction.categoryId;
        document.getElementById('trans-date').value = transaction.date.toISOString().split('T')[0];

        // Modify form submission to handle edit
        transactionForm.removeEventListener('submit', handleTransactionSubmit);
        transactionForm.addEventListener('submit', async function handleEditSubmit(e) {
            e.preventDefault();

            const updatedTransaction = {
                type: document.getElementById('trans-type').value,
                amount: parseFloat(document.getElementById('trans-amount').value),
                description: document.getElementById('trans-description').value,
                categoryId: parseInt(document.getElementById('trans-category').value),
                date: new Date(document.getElementById('trans-date').value)
            };

            const category = state.categories.find(cat => cat.id === updatedTransaction.categoryId);
            if (category) {
                updatedTransaction.category = category.name;
                updatedTransaction.icon = category.icon;
            }

            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/transactions/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(updatedTransaction)
                });

                if (response.ok) {
                    const savedTransaction = await response.json();
                    // Update in state
                    Object.assign(transaction, savedTransaction);

                    // Update UI
                    closeModal();
                    updateSummaryCards();
                    renderRecentTransactions();
                    renderTransactionsTable();
                    renderCharts();

                    // Reset form and event listener
                    transactionForm.reset();
                    transactionForm.removeEventListener('submit', handleEditSubmit);
                    transactionForm.addEventListener('submit', handleTransactionSubmit);
                } else {
                    alert('Failed to update transaction');
                }
            } catch (error) {
                console.error('Error updating transaction:', error);
                alert('Error updating transaction');
            }
        });
    }
    
    // Delete transaction
    async function deleteTransaction(id) {
        if (confirm('Are you sure you want to delete this transaction?')) {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/transactions/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    // Remove from state
                    state.transactions = state.transactions.filter(trans => trans.id !== id);

                    // Update UI
                    updateSummaryCards();
                    renderRecentTransactions();
                    renderTransactionsTable();
                    renderCharts();
                } else {
                    alert('Failed to delete transaction');
                }
            } catch (error) {
                console.error('Error deleting transaction:', error);
                alert('Error deleting transaction');
            }
        }
    }

    // Edit category
    function editCategory(id) {
        const category = state.categories.find(cat => cat.id === id);
        if (!category) return;

        openModal('category');

        // Fill form with category data
        document.getElementById('category-name').value = category.name;
        document.getElementById('category-budget').value = category.budget;
        document.getElementById('category-icon').value = category.icon;

        // Modify form submission to handle edit
        categoryForm.removeEventListener('submit', handleCategorySubmit);
        categoryForm.addEventListener('submit', function handleEditSubmit(e) {
            e.preventDefault();

            // Update category
            category.name = document.getElementById('category-name').value;
            category.budget = parseFloat(document.getElementById('category-budget').value);
            category.icon = document.getElementById('category-icon').value;

            saveData();

            // Update UI
            closeModal();
            renderCategories();
            renderCharts();

            // Reset form and event listener
            categoryForm.reset();
            categoryForm.removeEventListener('submit', handleEditSubmit);
            categoryForm.addEventListener('submit', handleCategorySubmit);
        });
    }

    // Delete category
    function deleteCategory(id) {
        if (confirm('Are you sure you want to delete this category? This will not delete associated transactions.')) {
            state.categories = state.categories.filter(cat => cat.id !== id);
            saveData();

            // Update UI
            renderCategories();
            renderCharts();
        }
    }
    
    // Render budget categories
    function renderCategories() {
        const container = document.getElementById('budget-categories');
        container.innerHTML = '';
        
        if (state.categories.length === 0) {
            container.innerHTML = '<p class="no-categories">No categories yet. Add your first category!</p>';
            return;
        }
        
        // Calculate spent amounts per category
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        const categorySpending = {};
        state.transactions
            .filter(trans => trans.type === 'expense' && 
                  trans.date.getMonth() === currentMonth && 
                  trans.date.getFullYear() === currentYear)
            .forEach(trans => {
                if (!categorySpending[trans.categoryId]) {
                    categorySpending[trans.categoryId] = 0;
                }
                categorySpending[trans.categoryId] += trans.amount;
            });
        
        state.categories.forEach(category => {
            if (category.name === 'Income') return; // Skip income category
            
            const spent = categorySpending[category.id] || 0;
            const percentage = category.budget > 0 ? Math.min((spent / category.budget) * 100, 100) : 0;
            const remaining = category.budget - spent;
            
            const categoryEl = document.createElement('div');
            categoryEl.className = 'budget-category';

            categoryEl.innerHTML = `
                <div class="budget-category-header">
                    <div class="budget-icon" style="background-color: ${category.color || '#4361ee'}">
                        <i class="fas ${category.icon}"></i>
                    </div>
                    <div class="budget-title">
                        <h3>${category.name}</h3>
                        <p>Budget: Rs${category.budget.toFixed(2)}</p>
                    </div>
                    <div class="category-actions">
                        <button class="action-btn edit-category-btn" data-id="${category.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete-category-btn" data-id="${category.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="budget-amount">
                    Spent: Rs${spent.toFixed(2)} / Remaining: Rs${remaining.toFixed(2)}
                </div>
                <div class="budget-progress">
                    <div class="budget-progress-bar" style="width: ${percentage}%; background-color: ${category.color || '#4361ee'}"></div>
                </div>
                <div class="budget-stats">
                    <span>${percentage.toFixed(0)}% of budget</span>
                    <span>Rs${remaining.toFixed(2)} left</span>
                </div>
            `;
            
            container.appendChild(categoryEl);
        });

        // Add event listeners to edit buttons
        document.querySelectorAll('.edit-category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.getAttribute('data-id'));
                editCategory(id);
            });
        });

        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.getAttribute('data-id'));
                deleteCategory(id);
            });
        });
    }

    // Edit goal
    function editGoal(id) {
        const goal = state.goals.find(g => g.id === id);
        if (!goal) return;

        openModal('goal');

        // Fill form with goal data
        prepareGoalModal(true, goal);

        // Modify form submission to handle edit
        goalForm.removeEventListener('submit', handleGoalSubmit);
        goalForm.addEventListener('submit', function handleEditSubmit(e) {
            e.preventDefault();

            // Update goal
            goal.name = document.getElementById('goal-name').value;
            goal.target = parseFloat(document.getElementById('goal-target').value);
            goal.saved = parseFloat(document.getElementById('goal-saved').value);
            goal.date = new Date(document.getElementById('goal-date').value);

            saveData();

            // Update UI
            closeModal();
            renderGoals();

            // Reset form and event listener
            goalForm.reset();
            goalForm.removeEventListener('submit', handleEditSubmit);
            goalForm.addEventListener('submit', handleGoalSubmit);
        });
    }
    
    // Render savings goals
    function renderGoals() {
        const container = document.getElementById('savings-goals');
        container.innerHTML = '';
        
        if (state.goals.length === 0) {
            container.innerHTML = '<p class="no-goals">No savings goals yet. Add your first goal!</p>';
            return;
        }
        
        state.goals.forEach(goal => {
            const percentage = (goal.saved / goal.target) * 100;
            const daysLeft = Math.ceil((goal.date - new Date()) / (1000 * 60 * 60 * 24));
            
            const goalEl = document.createElement('div');
            goalEl.className = 'goal-card';
            
            goalEl.innerHTML = `
                <div class="goal-header">
                    <div class="goal-title">
                        <h3>${goal.name}</h3>
                        <p>Target: Rs${goal.target.toFixed(2)}</p>
                    </div>
                    <div class="goal-actions">
                        <button class="action-btn edit-goal-btn" data-id="${goal.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <span>${daysLeft > 0 ? `${daysLeft} days left` : 'Completed'}</span>
                    </div>
                </div>
                <div class="goal-progress">
                    <div class="goal-progress-bar" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <div class="goal-details">
                    <span class="goal-amount">Saved: Rs${goal.saved.toFixed(2)} (${percentage.toFixed(1)}%)</span>
                    <span class="goal-date">${formatDate(goal.date)}</span>
                </div>
            `;
            
            container.appendChild(goalEl);
        });
        

        // Add event listeners to edit buttons
        document.querySelectorAll('.edit-goal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.getAttribute('data-id'));
                editGoal(id);
            });
        });
    }
    
    // Render charts
    function renderCharts() {
        renderCategoryChart();
        renderMonthlyChart();
        renderIncomeExpenseChart();
        renderTrendsChart();
        renderTopExpenses();
        renderCategoryBreakdown();
    }
    
    // Render category chart
    function renderCategoryChart() {
        const ctx = document.getElementById('categoryChart').getContext('2d');
        
        // Calculate spending by category for current month
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        const categorySpending = {};
        state.transactions
            .filter(trans => trans.type === 'expense' && 
                  trans.date.getMonth() === currentMonth && 
                  trans.date.getFullYear() === currentYear)
            .forEach(trans => {
                if (!categorySpending[trans.categoryId]) {
                    categorySpending[trans.categoryId] = 0;
                }
                categorySpending[trans.categoryId] += trans.amount;
            });
        
        // Prepare data for chart
        const categories = state.categories.filter(cat => cat.name !== 'Income');
        const labels = categories.map(cat => cat.name);
        const data = categories.map(cat => categorySpending[cat.id] || 0);
        const backgroundColors = categories.map(cat => cat.color || '#4361ee');
        
        // Destroy previous chart if exists
        if (categoryChart) {
            categoryChart.destroy();
        }
        
        categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: Rs${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Render monthly chart
    function renderMonthlyChart() {
        const ctx = document.getElementById('monthlyChart').getContext('2d');
        
        // Calculate income and expenses for each month
        const monthlyData = {};
        
        state.transactions.forEach(trans => {
            const monthYear = `${trans.date.getFullYear()}-${trans.date.getMonth()}`;
            
            if (!monthlyData[monthYear]) {
                monthlyData[monthYear] = {
                    income: 0,
                    expenses: 0,
                    month: trans.date.getMonth(),
                    year: trans.date.getFullYear()
                };
            }
            
            if (trans.type === 'income') {
                monthlyData[monthYear].income += trans.amount;
            } else {
                monthlyData[monthYear].expenses += trans.amount;
            }
        });
        
        // Sort by date (oldest first)
        const sortedMonths = Object.values(monthlyData).sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
        });
        
        // Get last 6 months
        const last6Months = sortedMonths.slice(-6);
        
        // Prepare data for chart
        const labels = last6Months.map(month => 
            `${getMonthName(month.month)} ${month.year.toString().slice(2)}`
        );
        const incomeData = last6Months.map(month => month.income);
        const expensesData = last6Months.map(month => month.expenses);
        
        // Destroy previous chart if exists
        if (monthlyChart) {
            monthlyChart.destroy();
        }
        
        monthlyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Income',
                        data: incomeData,
                        backgroundColor: '#4cc9f0',
                        borderColor: '#4cc9f0',
                        borderWidth: 1
                    },
                    {
                        label: 'Expenses',
                        data: expensesData,
                        backgroundColor: '#f94144',
                        borderColor: '#f94144',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.raw || 0;
                                return `${label}: Rs${value.toFixed(2)}`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Render income vs expense chart for reports
    function renderIncomeExpenseChart() {
        const ctx = document.getElementById('incomeExpenseChart').getContext('2d');
        
        // Filter transactions for selected month/year
        const monthTransactions = state.transactions.filter(trans => {
            return trans.date.getMonth() === state.currentMonth && 
                   trans.date.getFullYear() === state.currentYear;
        });
        
        // Calculate totals
        const income = monthTransactions
            .filter(trans => trans.type === 'income')
            .reduce((sum, trans) => sum + trans.amount, 0);
        
        const expenses = monthTransactions
            .filter(trans => trans.type === 'expense')
            .reduce((sum, trans) => sum + trans.amount, 0);
        
        // Destroy previous chart if exists
        if (incomeExpenseChart) {
            incomeExpenseChart.destroy();
        }
        
        incomeExpenseChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Income', 'Expenses'],
                datasets: [{
                    data: [income, expenses],
                    backgroundColor: ['#4cc9f0', '#f94144'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: Rs${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Render trends chart for reports
    function renderTrendsChart() {
        const ctx = document.getElementById('trendsChart').getContext('2d');
        
        // Calculate monthly trends for the past 12 months
        const monthlyTrends = Array(12).fill().map((_, i) => {
            const date = new Date(state.currentYear, state.currentMonth - i, 1);
            const month = date.getMonth();
            const year = date.getFullYear();
            
            const monthTransactions = state.transactions.filter(trans => {
                return trans.date.getMonth() === month && 
                       trans.date.getFullYear() === year;
            });
            
            const income = monthTransactions
                .filter(trans => trans.type === 'income')
                .reduce((sum, trans) => sum + trans.amount, 0);
            
            const expenses = monthTransactions
                .filter(trans => trans.type === 'expense')
                .reduce((sum, trans) => sum + trans.amount, 0);
            
            return {
                month,
                year,
                income,
                expenses,
                balance: income - expenses,
                label: `${getMonthName(month)} ${year.toString().slice(2)}`
            };
        }).reverse();
        
        // Prepare data for chart
        const labels = monthlyTrends.map(month => month.label);
        const incomeData = monthlyTrends.map(month => month.income);
        const expensesData = monthlyTrends.map(month => month.expenses);
        const balanceData = monthlyTrends.map(month => month.balance);
        
        // Destroy previous chart if exists
        if (trendsChart) {
            trendsChart.destroy();
        }
        
        trendsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Income',
                        data: incomeData,
                        backgroundColor: 'rgba(76, 201, 240, 0.2)',
                        borderColor: '#4cc9f0',
                        borderWidth: 2,
                        tension: 0.3
                    },
                    {
                        label: 'Expenses',
                        data: expensesData,
                        backgroundColor: 'rgba(249, 65, 68, 0.2)',
                        borderColor: '#f94144',
                        borderWidth: 2,
                        tension: 0.3
                    },
                    {
                        label: 'Balance',
                        data: balanceData,
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: '#4bc0c0',
                        borderWidth: 2,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: false
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.raw || 0;
                                return `${label}: Rs${value.toFixed(2)}`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Render top expenses for reports
    function renderTopExpenses() {
        const container = document.getElementById('top-expenses');
        container.innerHTML = '';
        
        // Filter expenses for selected month/year
        const monthExpenses = state.transactions.filter(trans => {
            return trans.type === 'expense' && 
                   trans.date.getMonth() === state.currentMonth && 
                   trans.date.getFullYear() === state.currentYear;
        });
        
        // Sort by amount (descending)
        const sortedExpenses = [...monthExpenses].sort((a, b) => b.amount - a.amount);
        
        // Get top 5
        const topExpenses = sortedExpenses.slice(0, 5);
        
        if (topExpenses.length === 0) {
            container.innerHTML = '<li>No expenses this month</li>';
            return;
        }
        
        topExpenses.forEach(expense => {
            const li = document.createElement('li');
            const category = state.categories.find(cat => cat.id === expense.categoryId);
            
            li.innerHTML = `
                <span>
                    <i class="fas ${expense.icon || 'fa-money-bill-wave'}"></i>
                    ${expense.description}
                </span>
                <span class="expense">Rs${expense.amount.toFixed(2)}</span>
            `;
            
            container.appendChild(li);
        });
    }
    
    // Render category breakdown for reports
    function renderCategoryBreakdown() {
        const container = document.getElementById('category-breakdown');
        container.innerHTML = '';
        
        // Filter expenses for selected month/year
        const monthExpenses = state.transactions.filter(trans => {
            return trans.type === 'expense' && 
                   trans.date.getMonth() === state.currentMonth && 
                   trans.date.getFullYear() === state.currentYear;
        });
        
        // Calculate total expenses
        const totalExpenses = monthExpenses.reduce((sum, trans) => sum + trans.amount, 0);
        
        // Group by category
        const categoryTotals = {};
        monthExpenses.forEach(expense => {
            if (!categoryTotals[expense.categoryId]) {
                categoryTotals[expense.categoryId] = 0;
            }
            categoryTotals[expense.categoryId] += expense.amount;
        });
        
        // Convert to array and sort by amount (descending)
        const categoryArray = Object.entries(categoryTotals)
            .map(([categoryId, amount]) => {
                const category = state.categories.find(cat => cat.id === parseInt(categoryId));
                return {
                    name: category?.name || 'Unknown',
                    amount,
                    percentage: totalExpenses > 0 ? (amount / totalExpenses * 100) : 0,
                    color: category?.color || '#4361ee'
                };
            })
            .sort((a, b) => b.amount - a.amount);
        
        if (categoryArray.length === 0) {
            container.innerHTML = '<li>No expenses this month</li>';
            return;
        }
        
        categoryArray.forEach(category => {
            const li = document.createElement('li');
            
            li.innerHTML = `
                <span>
                    <span class="color-indicator" style="background-color: ${category.color}"></span>
                    ${category.name}
                </span>
                <span>Rs${category.percentage.toFixed(1)}% (Rs${category.amount.toFixed(2)})</span>
            `;
            
            container.appendChild(li);
        });
    }
    
    // Set current month/year for reports
    function setCurrentMonthYear() {
        const monthName = getMonthName(state.currentMonth);
        document.getElementById('current-month').textContent = `${monthName} ${state.currentYear}`;
    }
    
    // Helper function to format date
    function formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    // Helper function to get month name
    function getMonthName(monthIndex) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return months[monthIndex];
    }

    // Export transactions to Excel
    function exportToExcel() {
        if (state.transactions.length === 0) {
            alert('No transactions to export.');
            return;
        }

        // Prepare data for Excel
        const data = [
            ['Date', 'Description', 'Category', 'Type', 'Amount'] // Header row
        ];

        // Add transaction rows
        state.transactions.forEach(trans => {
            const category = state.categories.find(cat => cat.id === trans.categoryId);
            const categoryName = category ? category.name : trans.category;
            const formattedDate = formatDate(trans.date);
            const type = trans.type === 'income' ? 'Income' : 'Expense';
            const amount = trans.amount;

            data.push([formattedDate, trans.description, categoryName, type, amount]);
        });

        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(data);

        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

        // Download file
        XLSX.writeFile(wb, 'transactions.xlsx');
    }

    // Initialize the app
    init();
});
