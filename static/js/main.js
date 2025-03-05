let habits = [];
let notes = [];

// Fetch habits from server
async function fetchHabits() {
    try {
        const response = await fetch('/api/habits');
        habits = await response.json();
        renderHabits();
        updateProgress();
        renderUpcomingHabits();
    } catch (error) {
        showToast('Erro ao carregar hábitos', 'error');
    }
}

// Render habits list
function renderHabits() {
    const habitsList = document.getElementById('habits-list');
    habitsList.innerHTML = '';
    
    // Group habits by period
    const habitsByPeriod = {
        morning: habits.filter(h => {
            const [hours] = h.time.split(':');
            return parseInt(hours) >= 5 && parseInt(hours) < 12;
        }),
        afternoon: habits.filter(h => {
            const [hours] = h.time.split(':');
            return parseInt(hours) >= 12 && parseInt(hours) < 18;
        }),
        evening: habits.filter(h => {
            const [hours] = h.time.split(':');
            return parseInt(hours) >= 18 || parseInt(hours) < 5;
        })
    };
    
    // Render habits by period
    const periods = [
        { key: 'morning', title: 'Manhã', icon: 'sun' },
        { key: 'afternoon', title: 'Tarde', icon: 'cloud-sun' },
        { key: 'evening', title: 'Noite', icon: 'moon' }
    ];
    
    periods.forEach(period => {
        const periodHabits = habitsByPeriod[period.key];
        if (periodHabits.length > 0) {
            const periodSection = document.createElement('div');
            periodSection.className = 'mb-4';
            periodSection.innerHTML = `
                <div class="d-flex align-items-center mb-3">
                    <i class="fas fa-${period.icon} me-2"></i>
                    <h5 class="mb-0">${period.title}</h5>
                </div>
            `;
            
            const periodList = document.createElement('div');
            periodList.className = 'list-group';
            
            periodHabits.forEach(habit => {
                const habitElement = document.createElement('div');
                habitElement.className = 'list-group-item habit-card';
                if (isHabitUrgent(habit)) {
                    habitElement.classList.add('urgent');
                }
                
                const completedTime = habit.completed_at ? new Date(habit.completed_at).toLocaleTimeString('pt-BR') : '';
                
                habitElement.innerHTML = `
                    <div class="d-flex align-items-center">
                        <div class="form-check me-3">
                            <input class="form-check-input" type="checkbox" ${habit.completed ? 'checked' : ''} onchange="completeHabit(${habit.id})">
                        </div>
                        <div class="flex-grow-1 ${habit.completed ? 'text-decoration-line-through' : ''}">
                            <div class="time-indicator">
                                <i class="fas fa-clock"></i> ${habit.time}
                                ${habit.completed ? `<small class="text-success ms-2">(Concluído às ${completedTime})</small>` : ''}
                            </div>
                            <h5 class="habit-title">${habit.title}</h5>
                            <p class="habit-description">${habit.description}</p>
                        </div>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-primary" onclick="editHabit(${habit.id})"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteHabit(${habit.id})"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                `;

                // Add click event listener to the habit card
                habitElement.addEventListener('click', (event) => {
                    // Check if the click was on the buttons or checkbox
                    if (!event.target.closest('.btn-group') && !event.target.closest('.form-check')) {
                        completeHabit(habit.id);
                    }
                });
                
                periodList.appendChild(habitElement);
            });
            
            periodSection.appendChild(periodList);
            habitsList.appendChild(periodSection);
        }
    });

    // Update charts after rendering habits
    updateWeeklyPerformanceChart();
    updateDailyStatisticsChart();
}

// Check if habit is urgent (within next hour)
function isHabitUrgent(habit) {
    const now = new Date();
    const [hours, minutes] = habit.time.split(':');
    const habitTime = new Date();
    habitTime.setHours(parseInt(hours), parseInt(minutes), 0);
    
    const timeDiff = habitTime - now;
    return timeDiff > 0 && timeDiff <= 3600000; // 1 hour in milliseconds
}

// Update progress bars
function updateProgress() {
    const completedHabits = habits.filter(h => h.completed).length;
    const totalHabits = habits.length;
    const progress = totalHabits > 0 ? (completedHabits / totalHabits) * 100 : 0;
    
    document.getElementById('progress-bar').style.width = `${progress}%`;
    document.getElementById('progress-bar').textContent = `${Math.round(progress)}%`;
    
    // Update annual progress
    document.getElementById('annual-progress-bar').style.width = `${progress}%`;
    document.getElementById('annual-progress-text').textContent = `${Math.round(progress)}%`;
}

// Render upcoming habits
let carouselInterval; // Add global variable for carousel interval

function renderUpcomingHabits() {
    const container = document.getElementById('upcoming-habits-container');
    container.innerHTML = '';
    
    // Clear existing interval if any
    if (carouselInterval) {
        clearInterval(carouselInterval);
    }
    
    const now = new Date();
    const upcomingHabits = habits
        .filter(h => {
            if (h.completed) return false;
            const [hours, minutes] = h.time.split(':');
            const habitTime = new Date();
            habitTime.setHours(parseInt(hours), parseInt(minutes), 0);
            
            // Compare only hours and minutes
            const currentTime = new Date();
            return habitTime.getHours() > currentTime.getHours() ||
                   (habitTime.getHours() === currentTime.getHours() && 
                    habitTime.getMinutes() > currentTime.getMinutes());
        })
        .sort((a, b) => {
            const timeA = new Date(`1970-01-01T${a.time}`);
            const timeB = new Date(`1970-01-01T${b.time}`);
            return timeA - timeB;
        })
        .slice(0, 3);
    
    if (upcomingHabits.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'upcoming-habit-card';
        emptyMessage.innerHTML = `
            <div class="time-indicator">
                <i class="fas fa-check-circle"></i>
            </div>
            <h6>Todos os hábitos concluídos!</h6>
        `;
        container.appendChild(emptyMessage);
        return;
    }

    const carouselContainer = document.createElement('div');
    carouselContainer.className = 'carousel-container';
    carouselContainer.style.transition = 'transform 0.5s ease-in-out';
    container.appendChild(carouselContainer);

    upcomingHabits.forEach((habit, index) => {
        const habitCard = document.createElement('div');
        habitCard.className = 'upcoming-habit-card';
        habitCard.style.animationDelay = `${index * 0.2}s`;
        
        const timeLeft = getTimeLeft(habit.time);
        const isUrgent = isHabitUrgent(habit);
        
        habitCard.innerHTML = `
            <div class="time-indicator ${isUrgent ? 'urgent' : ''}">
                <i class="fas fa-clock"></i> ${habit.time}
                <small>(${timeLeft})</small>
            </div>
            <h6>${habit.title}</h6>
        `;
        carouselContainer.appendChild(habitCard);
    });

    if (upcomingHabits.length > 1) {
        let currentIndex = 0;
        const cardWidth = 270;
        carouselInterval = setInterval(() => {
            currentIndex = (currentIndex + 1) % upcomingHabits.length;
            carouselContainer.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
        }, 5000);
    }
}

// Update the isHabitUrgent function
function isHabitUrgent(habit) {
    const now = new Date();
    const [hours, minutes] = habit.time.split(':');
    const habitTime = new Date();
    habitTime.setHours(parseInt(hours), parseInt(minutes), 0);
    
    // Compare only hours and minutes
    const timeDiff = (habitTime.getHours() * 60 + habitTime.getMinutes()) - 
                     (now.getHours() * 60 + now.getMinutes());
    return timeDiff > 0 && timeDiff <= 60; // Within the next hour
}

// Handle habit form submission
document.getElementById('save-habit').addEventListener('click', async () => {
    const habitId = document.getElementById('habit-id').value;
    const title = document.getElementById('habit-title').value;
    const description = document.getElementById('habit-description').value;
    const time = document.getElementById('habit-time').value;
    
    const habitData = { title, description, time };
    
    try {
        const url = habitId ? `/api/habits/${habitId}` : '/api/habits';
        const method = habitId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(habitData)
        });
        
        if (response.ok) {
            await fetchHabits();
            bootstrap.Modal.getInstance(document.getElementById('habitModal')).hide();
            showToast('Hábito salvo com sucesso!', 'success');
        }
    } catch (error) {
        showToast('Erro ao salvar hábito', 'error');
    }
});

// Edit habit
function editHabit(id) {
    const habit = habits.find(h => h.id === id);
    if (habit) {
        document.getElementById('habit-id').value = habit.id;
        document.getElementById('habit-title').value = habit.title;
        document.getElementById('habit-description').value = habit.description;
        document.getElementById('habit-time').value = habit.time;
        
        const modal = new bootstrap.Modal(document.getElementById('habitModal'));
        modal.show();
    }
}

// Delete habit
async function deleteHabit(id) {
    if (confirm('Tem certeza que deseja excluir este hábito?')) {
        try {
            const response = await fetch(`/api/habits/${id}`, { method: 'DELETE' });
            if (response.ok) {
                await fetchHabits();
                showToast('Hábito excluído com sucesso!', 'success');
            }
        } catch (error) {
            showToast('Erro ao excluir hábito', 'error');
        }
    }
}

// Complete habit
async function completeHabit(id) {
    try {
        const habit = habits.find(h => h.id === id);
        if (!habit) {
            showToast('Hábito não encontrado', 'error');
            return;
        }
        
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch('/api/checkmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                habit_id: id,
                date: today,
                completed: !habit.completed
            })
        });
        
        if (!response.ok) {
            throw new Error('Falha na resposta do servidor');
        }
        
        await fetchHabits();
        const action = !habit.completed ? 'concluído' : 'desmarcado';
        showToast(`Hábito ${action} com sucesso!`, 'success');
    } catch (error) {
        console.error('Erro ao atualizar hábito:', error);
        showToast('Erro ao atualizar hábito', 'error');
    }
}

// Reset habits
async function resetHabits() {
    if (confirm('Tem certeza que deseja resetar todos os hábitos?')) {
        try {
            const response = await fetch('/api/habits/reset', { method: 'POST' });
            if (response.ok) {
                await fetchHabits();
                showToast('Hábitos resetados com sucesso!', 'success');
            }
        } catch (error) {
            showToast('Erro ao resetar hábitos', 'error');
        }
    }
}

// Notes functionality
function renderNotes() {
    const notesList = document.getElementById('notes-list');
    notesList.innerHTML = '';
    
    notes.forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.className = 'list-group-item';
        
        const previewText = note.content.length > 100 ? 
            note.content.substring(0, 100) + '...' : 
            note.content;
        
        const escapedContent = note.content
            .replace(/[\\]/g, '\\\\')
            .replace(/["]/g, '\\"')
            .replace(/[\n]/g, '\\n')
            .replace(/[']/g, '\\\'')
            .replace(/[&]/g, '&amp;')
            .replace(/[<]/g, '&lt;')
            .replace(/[>]/g, '&gt;');
        
        noteElement.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div style="width: 85%;">
                    <small class="text-muted">${new Date(note.created_at).toLocaleString('pt-BR')}</small>
                    <p class="mb-1 mt-1 note-content">${previewText}</p>
                    ${note.content.length > 100 ? 
                        `<button class="btn btn-link btn-sm p-0 text-primary" onclick="showNoteModal('${escapedContent}')">Ler mais</button>` : 
                        ''}
                </div>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary" onclick="editNote(${note.id},'${escapedContent}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteNote(${note.id})"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `;
        notesList.appendChild(noteElement);
    });
}

// Show note in modal
function showNoteModal(content) {
    const modalContent = document.createElement('div');
    modalContent.className = 'modal fade';
    modalContent.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Anotação</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p>${content.replace(/\n/g, '<br>')}</p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalContent);
    const modal = new bootstrap.Modal(modalContent);
    modal.show();
    modalContent.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modalContent);
    });
}

function getTimeLeft(habitTime) {
    const now = new Date();
    const [hours, minutes] = habitTime.split(':');
    const targetTime = new Date();
    targetTime.setHours(parseInt(hours), parseInt(minutes), 0);
    
    if (targetTime < now) {
        targetTime.setDate(targetTime.getDate() + 1);
    }
    
    const diff = targetTime - now;
    const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
    const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hoursLeft > 0) {
        return `${hoursLeft}h ${minutesLeft}min`;
    } else {
        return `${minutesLeft}min`;
    }
}

// Fetch notes from server
async function fetchNotes() {
    try {
        const response = await fetch('/api/notes');
        notes = await response.json();
        renderNotes();
    } catch (error) {
        showToast('Erro ao carregar anotações', 'error');
    }
}

// Save note
async function saveNote() {
    const noteInput = document.getElementById('note-input');
    const content = noteInput.value.trim();
    
    if (!content) return;
    
    try {
        const response = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        
        if (response.ok) {
            noteInput.value = '';
            await fetchNotes();
            showToast('Anotação salva com sucesso!', 'success');
        }
    } catch (error) {
        showToast('Erro ao salvar anotação', 'error');
    }
}

// Delete note
async function deleteNote(id) {
    if (confirm('Tem certeza que deseja excluir esta anotação?')) {
        try {
            const response = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
            if (response.ok) {
                await fetchNotes();
                showToast('Anotação excluída com sucesso!', 'success');
            }
        } catch (error) {
            showToast('Erro ao excluir anotação', 'error');
        }
    }
}

// Edit note
async function editNote(id, content) {
    const newContent = prompt('Editar anotação:', content);
    if (newContent && newContent !== content) {
        try {
            const response = await fetch(`/api/notes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newContent })
            });
            
            if (response.ok) {
                await fetchNotes();
                showToast('Anotação atualizada com sucesso!', 'success');
            }
        } catch (error) {
            showToast('Erro ao atualizar anotação', 'error');
        }
    }
}

// Function to handle day completion
async function completeDay() {
    if (!confirm('Tem certeza que deseja concluir o dia? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        const response = await fetch('/api/day-completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to complete day');
        }

        showDayCompletionModal();
        await fetchDayCompletions();
        showToast('Dia concluído com sucesso!', 'success');
    } catch (error) {
        console.error('Error completing day:', error);
        showToast(error.message || 'Erro ao concluir o dia', 'error');
    }
}

// Function to show day completion modal
function showDayCompletionModal() {
    const completedHabits = habits.filter(h => h.completed);
    const todayNotes = notes.filter(n => {
        const noteDate = new Date(n.created_at).toDateString();
        const today = new Date().toDateString();
        return noteDate === today;
    });

    const modalContent = document.createElement('div');
    modalContent.className = 'modal fade';
    modalContent.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Resumo do Dia</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <h6>Hábitos Concluídos</h6>
                    <ul class="list-group mb-3">
                        ${completedHabits.map(habit => {
                            const completedTime = habit.completed_at ? new Date(habit.completed_at).toLocaleTimeString('pt-BR') : '';
                            return `
                                <li class="list-group-item">
                                    <i class="fas fa-check-circle text-success me-2"></i>
                                    ${habit.title}
                                    <small class="text-muted">(${habit.time || 'Horário não definido'})</small>
                                    ${completedTime ? `<small class="text-success ms-2">(Concluído às ${completedTime})</small>` : ''}
                                </li>
                            `;
                        }).join('')}
                    </ul>
                    ${todayNotes.length > 0 ? `
                        <h6>Anotações do Dia</h6>
                        <ul class="list-group">
                            ${todayNotes.map(note => `
                                <li class="list-group-item">
                                    <small class="text-muted">${new Date(note.created_at).toLocaleTimeString('pt-BR')}</small>
                                    <p class="mb-0">${note.content}</p>
                                </li>
                            `).join('')}
                        </ul>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalContent);
    const modal = new bootstrap.Modal(modalContent);
    modal.show();
    modalContent.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modalContent);
    });
}

// Function to fetch day completions
async function fetchDayCompletions() {
    try {
        const response = await fetch('/api/day-completions');
        const completions = await response.json();
        renderCompletionCalendar(completions);
    } catch (error) {
        console.error('Error fetching day completions:', error);
        showToast('Erro ao carregar histórico de conclusões', 'error');
    }
}

// Function to render completion calendar
async function showHistoricalDayModal(date) {
    try {
        const response = await fetch(`/api/day-completion/${date}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch day completion details');
            return;
        }

        const modalContent = document.createElement('div');
        modalContent.className = 'modal fade';
        modalContent.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Detalhes do Dia ${new Date(date).toLocaleDateString('pt-BR')}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-4">
                            <h6 class="mb-3">Hábitos Concluídos</h6>
                            <div class="list-group">
                                ${data.habits.map(habit => `
                                    <div class="list-group-item">
                                        <div class="d-flex justify-content-between align-items-center">
                                            <div>
                                                <h6 class="mb-1">${habit.title}</h6>
                                                <small class="text-muted">
                                                    <i class="fas fa-clock"></i> ${habit.time || 'Sem horário definido'}
                                                </small>
                                            </div>
                                            <small class="text-success">
                                                Concluído às ${new Date(habit.completed_at).toLocaleTimeString('pt-BR')}
                                            </small>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ${data.notes.length > 0 ? `
                            <div>
                                <h6 class="mb-3">Anotações do Dia</h6>
                                <div class="list-group">
                                    ${data.notes.map(note => `
                                        <div class="list-group-item">
                                            <small class="text-muted">${new Date(note.created_at).toLocaleTimeString('pt-BR')}</small>
                                            <p class="mb-0 mt-1">${note.content}</p>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modalContent);
        const modal = new bootstrap.Modal(modalContent);
        modal.show();

        modalContent.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modalContent);
        });
    } catch (error) {
        console.error('Error fetching day completion details:', error);
        showToast('Erro ao carregar detalhes do dia', 'error');
    }
}

function renderCompletionCalendar(completions) {
    const calendar = document.getElementById('completion-calendar');
    calendar.innerHTML = '';

    completions.forEach(completion => {
        const date = new Date(completion.date);
        const dayElement = document.createElement('div');
        dayElement.className = 'completion-day';
        dayElement.innerHTML = `
            <div class="completion-date" data-completion-id="${completion.id}">
                <i class="fas fa-calendar-check text-success me-2"></i>
                ${date.toLocaleDateString('pt-BR')}
                <button class="btn btn-sm btn-info ms-2" onclick="showHistoricalDayModal('${completion.date}')" title="Visualizar detalhes">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-danger ms-2" onclick="deleteCompletion(${completion.id}, '${date.toLocaleDateString('pt-BR')}')" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        calendar.appendChild(dayElement);
    });
}

async function deleteCompletion(completionId, dateStr) {
    if (!confirm('Tem certeza que deseja excluir este registro de conclusão? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        const response = await fetch(`/api/day-completions/${completionId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete day completion');
        }

        await fetchDayCompletions();
        showToast('Registro de conclusão excluído com sucesso!', 'success');
    } catch (error) {
        console.error('Error deleting day completion:', error);
        showToast('Erro ao excluir o registro de conclusão', 'error');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchHabits();
    fetchNotes();
    
    // Clear form when modal is hidden
    document.getElementById('habitModal').addEventListener('hidden.bs.modal', () => {
        document.getElementById('habit-form').reset();
        document.getElementById('habit-id').value = '';
    });

    // Add note save button event listener
    document.getElementById('save-note').addEventListener('click', saveNote);

    // Add event listener for complete day button
    document.getElementById('complete-day').addEventListener('click', completeDay);
});

// Manual carousel navigation
function moveCarousel(direction) {
    const container = document.querySelector('.carousel-container');
    const cards = document.querySelectorAll('.upcoming-habit-card');
    if (cards.length <= 1) return;

    const cardWidth = 270;
    let currentPosition = parseInt(container.style.transform.replace('translateX(', '').replace('px)', '') || 0);
    const maxPosition = -(cards.length - 1) * cardWidth;

    // Calculate new position
    let newPosition = currentPosition + (direction * cardWidth);
    
    // Handle bounds
    if (newPosition > 0) newPosition = maxPosition;
    if (newPosition < maxPosition) newPosition = 0;

    // Apply transform
    container.style.transform = `translateX(${newPosition}px)`;
}

// Toast notification
function showToast(message, type = 'info') {
    Toastify({
        text: message,
        duration: 3000,
        gravity: 'top',
        position: 'right',
        style: {
            background: type === 'error' ? '#ff6b6b' : '#00b894'
        },
    }).showToast();
}

// Weekly Performance Chart
function updateWeeklyPerformanceChart() {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const completionData = new Array(7).fill(0);
    const totalData = new Array(7).fill(0);
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    habits.forEach(habit => {
        const habitDate = habit.completed_at ? new Date(habit.completed_at) : null;
        if (habitDate) {
            const dayIndex = habitDate.getDay();
            completionData[dayIndex]++;
        }
        const timeToday = new Date(`1970-01-01T${habit.time}`);
        const dayIndex = today.getDay();
        totalData[dayIndex]++;
    });

    const trace1 = {
        x: days,
        y: completionData,
        name: 'Completados',
        type: 'bar',
        marker: {
            color: 'rgba(108, 92, 231, 0.8)',
            line: {
                color: 'rgba(108, 92, 231, 1)',
                width: 1.5
            }
        }
    };

    const trace2 = {
        x: days,
        y: totalData,
        name: 'Total',
        type: 'bar',
        marker: {
            color: 'rgba(255, 255, 255, 0.2)',
            line: {
                color: 'rgba(255, 255, 255, 0.5)',
                width: 1.5
            }
        }
    };

    const layout = {
        title: 'Desempenho Semanal',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#fff' },
        barmode: 'group',
        xaxis: {
            gridcolor: 'rgba(108, 92, 231, 0.1)',
            tickfont: { color: '#fff' }
        },
        yaxis: {
            gridcolor: 'rgba(108, 92, 231, 0.1)',
            tickfont: { color: '#fff' }
        },
        showlegend: true,
        legend: {
            font: { color: '#fff' }
        }
    };

    Plotly.newPlot('performance-chart', [trace1, trace2], layout);
}

// Daily Statistics Chart
function updateDailyStatisticsChart() {
    // Get current hour
    const now = new Date();
    const currentHour = now.getHours();

    // Initialize arrays for x-axis (hours) and y-axis (completion counts)
    const hours = Array.from({length: 24}, (_, i) => i);
    const completions = new Array(24).fill(0);

    // Count completions by hour
    habits.forEach(habit => {
        if (habit.completed && habit.completed_at) {
            const completedHour = new Date(habit.completed_at).getHours();
            completions[completedHour]++;
        }
    });

    // Create the line chart trace
    const trace = {
        x: hours.map(h => `${h}:00`),
        y: completions,
        type: 'scatter',
        mode: 'lines',
        name: 'Hábitos Concluídos',
        line: {
            color: 'rgba(108, 92, 231, 1)',
            width: 3,
            shape: 'spline'
        },
        fill: 'tozeroy',
        fillcolor: 'rgba(108, 92, 231, 0.2)'
    };

    const layout = {
        title: 'Conclusões ao Longo do Dia',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#fff' },
        xaxis: {
            title: 'Hora',
            gridcolor: 'rgba(108, 92, 231, 0.1)',
            tickfont: { color: '#fff' },
            tickformat: '%H:%M'
        },
        yaxis: {
            title: 'Hábitos Concluídos',
            gridcolor: 'rgba(108, 92, 231, 0.1)',
            tickfont: { color: '#fff' },
            rangemode: 'nonnegative'
        },
        showlegend: false,
        hovermode: 'x unified',
        hoverlabel: {
            bgcolor: '#2c3e50',
            font: { color: '#fff' }
        }
    };

    Plotly.newPlot('daily-stats-chart', [trace], layout);
}

// Update the updateProgress function to include chart updates
function updateProgress() {
    const completedHabits = habits.filter(h => h.completed).length;
    const totalHabits = habits.length;
    const progress = totalHabits > 0 ? (completedHabits / totalHabits) * 100 : 0;
    
    // Update daily progress
    document.getElementById('progress-bar').style.width = `${progress}%`;
    document.getElementById('progress-bar').textContent = `${Math.round(progress)}%`;
    
    // Calculate annual progress based on daily completions
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const daysPassed = Math.floor((today - startOfYear) / (1000 * 60 * 60 * 24));
    const totalDaysInYear = new Date(today.getFullYear(), 11, 31).getDate() + 364;
    
    // Calculate annual progress percentage
    const annualProgress = (daysPassed / totalDaysInYear) * progress;
    
    // Update annual progress UI
    document.getElementById('annual-progress-bar').style.width = `${annualProgress}%`;
    document.getElementById('annual-progress-text').textContent = `${Math.round(annualProgress)}%`;

    // Update charts
    updateWeeklyPerformanceChart();
    updateDailyStatisticsChart();

    // Show/hide complete day button based on all habits being completed
    const completeDayButton = document.getElementById('complete-day');
    if (totalHabits > 0 && completedHabits === totalHabits) {
        completeDayButton.classList.remove('d-none');
    } else {
        completeDayButton.classList.add('d-none');
    }
}

// Reset habits
async function resetHabits() {
    if (confirm('Tem certeza que deseja resetar todos os hábitos?')) {
        try {
            const response = await fetch('/api/habits/reset', { method: 'POST' });
            if (response.ok) {
                await fetchHabits();
                showToast('Hábitos resetados com sucesso!', 'success');
            }
        } catch (error) {
            showToast('Erro ao resetar hábitos', 'error');
        }
    }
}

// Notes functionality
function renderNotes() {
    const notesList = document.getElementById('notes-list');
    notesList.innerHTML = '';
    
    notes.forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.className = 'list-group-item';
        
        const previewText = note.content.length > 100 ? 
            note.content.substring(0, 100) + '...' : 
            note.content;
        
        const escapedContent = note.content
            .replace(/[\\]/g, '\\\\')
            .replace(/["]/g, '\\"')
            .replace(/[\n]/g, '\\n')
            .replace(/[']/g, '\\\'')
            .replace(/[&]/g, '&amp;')
            .replace(/[<]/g, '&lt;')
            .replace(/[>]/g, '&gt;');
        
        noteElement.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div style="width: 85%;">
                    <small class="text-muted">${new Date(note.created_at).toLocaleString('pt-BR')}</small>
                    <p class="mb-1 mt-1 note-content">${previewText}</p>
                    ${note.content.length > 100 ? 
                        `<button class="btn btn-link btn-sm p-0 text-primary" onclick="showNoteModal('${escapedContent}')">Ler mais</button>` : 
                        ''}
                </div>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary" onclick="editNote(${note.id},'${escapedContent}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteNote(${note.id})"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `;
        notesList.appendChild(noteElement);
    });
}

// Show note in modal
function showNoteModal(content) {
    const modalContent = document.createElement('div');
    modalContent.className = 'modal fade';
    modalContent.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Anotação</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p>${content.replace(/\n/g, '<br>')}</p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalContent);
    const modal = new bootstrap.Modal(modalContent);
    modal.show();
    modalContent.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modalContent);
    });
}

function getTimeLeft(habitTime) {
    const now = new Date();
    const [hours, minutes] = habitTime.split(':');
    const targetTime = new Date();
    targetTime.setHours(parseInt(hours), parseInt(minutes), 0);
    
    if (targetTime < now) {
        targetTime.setDate(targetTime.getDate() + 1);
    }
    
    const diff = targetTime - now;
    const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
    const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hoursLeft > 0) {
        return `${hoursLeft}h ${minutesLeft}min`;
    } else {
        return `${minutesLeft}min`;
    }
}

// Fetch notes from server
async function fetchNotes() {
    try {
        const response = await fetch('/api/notes');
        notes = await response.json();
        renderNotes();
    } catch (error) {
        showToast('Erro ao carregar anotações', 'error');
    }
}

// Save note
async function saveNote() {
    const noteInput = document.getElementById('note-input');
    const content = noteInput.value.trim();
    
    if (!content) return;
    
    try {
        const response = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        
        if (response.ok) {
            noteInput.value = '';
            await fetchNotes();
            showToast('Anotação salva com sucesso!', 'success');
        }
    } catch (error) {
        showToast('Erro ao salvar anotação', 'error');
    }
}

// Delete note
async function deleteNote(id) {
    if (confirm('Tem certeza que deseja excluir esta anotação?')) {
        try {
            const response = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
            if (response.ok) {
                await fetchNotes();
                showToast('Anotação excluída com sucesso!', 'success');
            }
        } catch (error) {
            showToast('Erro ao excluir anotação', 'error');
        }
    }
}

// Edit note
async function editNote(id, content) {
    const newContent = prompt('Editar anotação:', content);
    if (newContent && newContent !== content) {
        try {
            const response = await fetch(`/api/notes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newContent })
            });
            
            if (response.ok) {
                await fetchNotes();
                showToast('Anotação atualizada com sucesso!', 'success');
            }
        } catch (error) {
            showToast('Erro ao atualizar anotação', 'error');
        }
    }
}

// Function to handle day completion
async function completeDay() {
    if (!confirm('Tem certeza que deseja concluir o dia? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        const response = await fetch('/api/day-completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to complete day');
        }

        showDayCompletionModal();
        await fetchDayCompletions();
        showToast('Dia concluído com sucesso!', 'success');
    } catch (error) {
        console.error('Error completing day:', error);
        showToast(error.message || 'Erro ao concluir o dia', 'error');
    }
}

// Function to show day completion modal
function showDayCompletionModal() {
    const completedHabits = habits.filter(h => h.completed);
    const todayNotes = notes.filter(n => {
        const noteDate = new Date(n.created_at).toDateString();
        const today = new Date().toDateString();
        return noteDate === today;
    });

    const modalContent = document.createElement('div');
    modalContent.className = 'modal fade';
    modalContent.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Resumo do Dia</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <h6>Hábitos Concluídos</h6>
                    <ul class="list-group mb-3">
                        ${completedHabits.map(habit => {
                            const completedTime = habit.completed_at ? new Date(habit.completed_at).toLocaleTimeString('pt-BR') : '';
                            return `
                                <li class="list-group-item">
                                    <i class="fas fa-check-circle text-success me-2"></i>
                                    ${habit.title}
                                    <small class="text-muted">(${habit.time || 'Horário não definido'})</small>
                                    ${completedTime ? `<small class="text-success ms-2">(Concluído às ${completedTime})</small>` : ''}
                                </li>
                            `;
                        }).join('')}
                    </ul>
                    ${todayNotes.length > 0 ? `
                        <h6>Anotações do Dia</h6>
                        <ul class="list-group">
                            ${todayNotes.map(note => `
                                <li class="list-group-item">
                                    <small class="text-muted">${new Date(note.created_at).toLocaleTimeString('pt-BR')}</small>
                                    <p class="mb-0">${note.content}</p>
                                </li>
                            `).join('')}
                        </ul>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalContent);
    const modal = new bootstrap.Modal(modalContent);
    modal.show();
    modalContent.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modalContent);
    });
}

// Function to fetch day completions
async function fetchDayCompletions() {
    try {
        const response = await fetch('/api/day-completions');
        const completions = await response.json();
        renderCompletionCalendar(completions);
    } catch (error) {
        console.error('Error fetching day completions:', error);
        showToast('Erro ao carregar histórico de conclusões', 'error');
    }
}

// Function to render completion calendar
async function showHistoricalDayModal(date) {
    try {
        const response = await fetch(`/api/day-completion/${date}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch day completion details');
            return;
        }

        const modalContent = document.createElement('div');
        modalContent.className = 'modal fade';
        modalContent.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Detalhes do Dia ${new Date(date).toLocaleDateString('pt-BR')}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-4">
                            <h6 class="mb-3">Hábitos Concluídos</h6>
                            <div class="list-group">
                                ${data.habits.map(habit => `
                                    <div class="list-group-item">
                                        <div class="d-flex justify-content-between align-items-center">
                                            <div>
                                                <h6 class="mb-1">${habit.title}</h6>
                                                <small class="text-muted">
                                                    <i class="fas fa-clock"></i> ${habit.time || 'Sem horário definido'}
                                                </small>
                                            </div>
                                            <small class="text-success">
                                                Concluído às ${new Date(habit.completed_at).toLocaleTimeString('pt-BR')}
                                            </small>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ${data.notes.length > 0 ? `
                            <div>
                                <h6 class="mb-3">Anotações do Dia</h6>
                                <div class="list-group">
                                    ${data.notes.map(note => `
                                        <div class="list-group-item">
                                            <small class="text-muted">${new Date(note.created_at).toLocaleTimeString('pt-BR')}</small>
                                            <p class="mb-0 mt-1">${note.content}</p>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modalContent);
        const modal = new bootstrap.Modal(modalContent);
        modal.show();

        modalContent.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modalContent);
        });
    } catch (error) {
        console.error('Error fetching day completion details:', error);
        showToast('Erro ao carregar detalhes do dia', 'error');
    }
}

function renderCompletionCalendar(completions) {
    const calendar = document.getElementById('completion-calendar');
    calendar.innerHTML = '';

    completions.forEach(completion => {
        const date = new Date(completion.date);
        const dayElement = document.createElement('div');
        dayElement.className = 'completion-day';
        dayElement.innerHTML = `
            <div class="completion-date" data-completion-id="${completion.id}">
                <i class="fas fa-calendar-check text-success me-2"></i>
                ${date.toLocaleDateString('pt-BR')}
                <button class="btn btn-sm btn-info ms-2" onclick="showHistoricalDayModal('${completion.date}')" title="Visualizar detalhes">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-danger ms-2" onclick="deleteCompletion(${completion.id}, '${date.toLocaleDateString('pt-BR')}')" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        calendar.appendChild(dayElement);
    });
}

async function deleteCompletion(completionId, dateStr) {
    if (!confirm('Tem certeza que deseja excluir este registro de conclusão? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        const response = await fetch(`/api/day-completions/${completionId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete day completion');
        }

        await fetchDayCompletions();
        showToast('Registro de conclusão excluído com sucesso!', 'success');
    } catch (error) {
        console.error('Error deleting day completion:', error);
        showToast('Erro ao excluir o registro de conclusão', 'error');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchHabits();
    fetchNotes();
    
    // Clear form when modal is hidden
    document.getElementById('habitModal').addEventListener('hidden.bs.modal', () => {
        document.getElementById('habit-form').reset();
        document.getElementById('habit-id').value = '';
    });

    // Add note save button event listener
    document.getElementById('save-note').addEventListener('click', saveNote);

    // Add event listener for complete day button
    document.getElementById('complete-day').addEventListener('click', completeDay);
});

// Manual carousel navigation
function moveCarousel(direction) {
    const container = document.querySelector('.carousel-container');
    const cards = document.querySelectorAll('.upcoming-habit-card');
    if (cards.length <= 1) return;

    const cardWidth = 270;
    let currentPosition = parseInt(container.style.transform.replace('translateX(', '').replace('px)', '') || 0);
    const maxPosition = -(cards.length - 1) * cardWidth;

    // Calculate new position
    let newPosition = currentPosition + (direction * cardWidth);
    
    // Handle bounds
    if (newPosition > 0) newPosition = maxPosition;
    if (newPosition < maxPosition) newPosition = 0;

    // Apply transform
    container.style.transform = `translateX(${newPosition}px)`;
}

// Toast notification
function showToast(message, type = 'info') {
    Toastify({
        text: message,
        duration: 3000,
        gravity: 'top',
        position: 'right',
        style: {
            background: type === 'error' ? '#ff6b6b' : '#00b894'
        },
    }).showToast();
}

function getTimeLeft(habitTime) {
    const [hours, minutes] = habitTime.split(':');
    const now = new Date();
    const targetTime = new Date();
    targetTime.setHours(parseInt(hours), parseInt(minutes), 0);
    
    if (targetTime <= now) {
        targetTime.setDate(targetTime.getDate() + 1);
    }
    
    const diff = targetTime - now;
    const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
    const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hoursLeft > 0) {
        return `${hoursLeft}h ${minutesLeft}min`;
    } else {
        return `${minutesLeft}min`;
    }
}

// Weekly Performance Chart
function updateWeeklyPerformanceChart() {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const completionData = new Array(7).fill(0);
    const totalData = new Array(7).fill(0);
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    habits.forEach(habit => {
        const habitDate = habit.completed_at ? new Date(habit.completed_at) : null;
        if (habitDate) {
            const dayIndex = habitDate.getDay();
            completionData[dayIndex]++;
        }
        const timeToday = new Date(`1970-01-01T${habit.time}`);
        const dayIndex = today.getDay();
        totalData[dayIndex]++;
    });

    const trace1 = {
        x: days,
        y: completionData,
        name: 'Completados',
        type: 'bar',
        marker: {
            color: 'rgba(108, 92, 231, 0.8)',
            line: {
                color: 'rgba(108, 92, 231, 1)',
                width: 1.5
            }
        }
    };

    const trace2 = {
        x: days,
        y: totalData,
        name: 'Total',
        type: 'bar',
        marker: {
            color: 'rgba(255, 255, 255, 0.2)',
            line: {
                color: 'rgba(255, 255, 255, 0.5)',
                width: 1.5
            }
        }
    };

    const layout = {
        title: 'Desempenho Semanal',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#fff' },
        barmode: 'group',
        xaxis: {
            gridcolor: 'rgba(108, 92, 231, 0.1)',
            tickfont: { color: '#fff' }
        },
        yaxis: {
            gridcolor: 'rgba(108, 92, 231, 0.1)',
            tickfont: { color: '#fff' }
        },
        showlegend: true,
        legend: {
            font: { color: '#fff' }
        }
    };

    Plotly.newPlot('performance-chart', [trace1, trace2], layout);
}

// Daily Statistics Chart
function updateDailyStatisticsChart() {
    // Get current hour
    const now = new Date();
    const currentHour = now.getHours();

    // Initialize arrays for x-axis (hours) and y-axis (completion counts)
    const hours = Array.from({length: 24}, (_, i) => i);
    const completions = new Array(24).fill(0);

    // Count completions by hour
    habits.forEach(habit => {
        if (habit.completed && habit.completed_at) {
            const completedHour = new Date(habit.completed_at).getHours();
            completions[completedHour]++;
        }
    });

    // Create the line chart trace
    const trace = {
        x: hours.map(h => `${h}:00`),
        y: completions,
        type: 'scatter',
        mode: 'lines',
        name: 'Hábitos Concluídos',
        line: {
            color: 'rgba(108, 92, 231, 1)',
            width: 3,
            shape: 'spline'
        },
        fill: 'tozeroy',
        fillcolor: 'rgba(108, 92, 231, 0.2)'
    };

    const layout = {
        title: 'Conclusões ao Longo do Dia',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#fff' },
        xaxis: {
            title: 'Hora',
            gridcolor: 'rgba(108, 92, 231, 0.1)',
            tickfont: { color: '#fff' },
            tickformat: '%H:%M'
        },
        yaxis: {
            title: 'Hábitos Concluídos',
            gridcolor: 'rgba(108, 92, 231, 0.1)',
            tickfont: { color: '#fff' },
            rangemode: 'nonnegative'
        },
        showlegend: false,
        hovermode: 'x unified',
        hoverlabel: {
            bgcolor: '#2c3e50',
            font: { color: '#fff' }
        }
    };

    Plotly.newPlot('daily-stats-chart', [trace], layout);
}

// Update the updateProgress function to include chart updates
function updateProgress() {
    const completedHabits = habits.filter(h => h.completed).length;
    const totalHabits = habits.length;
    const progress = totalHabits > 0 ? (completedHabits / totalHabits) * 100 : 0;
    
    // Update daily progress
    document.getElementById('progress-bar').style.width = `${progress}%`;
    document.getElementById('progress-bar').textContent = `${Math.round(progress)}%`;
    
    // Calculate annual progress based on daily completions
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const daysPassed = Math.floor((today - startOfYear) / (1000 * 60 * 60 * 24));
    const totalDaysInYear = new Date(today.getFullYear(), 11, 31).getDate() + 364;
    
    // Calculate annual progress percentage
    const annualProgress = (daysPassed / totalDaysInYear) * progress;
    
    // Update annual progress UI
    document.getElementById('annual-progress-bar').style.width = `${annualProgress}%`;
    document.getElementById('annual-progress-text').textContent = `${Math.round(annualProgress)}%`;

    // Update charts
    updateWeeklyPerformanceChart();
    updateDailyStatisticsChart();

    // Show/hide complete day button based on all habits being completed
    const completeDayButton = document.getElementById('complete-day');
    if (totalHabits > 0 && completedHabits === totalHabits) {
        completeDayButton.classList.remove('d-none');
    } else {
        completeDayButton.classList.add('d-none');
    }
}

// Reset habits
async function resetHabits() {
    if (confirm('Tem certeza que deseja resetar todos os hábitos?')) {
        try {
            const response = await fetch('/api/habits/reset', { method: 'POST' });
            if (response.ok) {
                await fetchHabits();
                showToast('Hábitos resetados com sucesso!', 'success');
            }
        } catch (error) {
            showToast('Erro ao resetar hábitos', 'error');
        }
    }
}

// Notes functionality
function renderNotes() {
    const notesList = document.getElementById('notes-list');
    notesList.innerHTML = '';
    
    notes.forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.className = 'list-group-item';
        
        const previewText = note.content.length > 100 ? 
            note.content.substring(0, 100) + '...' : 
            note.content;
        
        const escapedContent = note.content
            .replace(/[\\]/g, '\\\\')
            .replace(/["]/g, '\\"')
            .replace(/[\n]/g, '\\n')
            .replace(/[']/g, '\\\'')
            .replace(/[&]/g, '&amp;')
            .replace(/[<]/g, '&lt;')
            .replace(/[>]/g, '&gt;');
        
        noteElement.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div style="width: 85%;">
                    <small class="text-muted">${new Date(note.created_at).toLocaleString('pt-BR')}</small>
                    <p class="mb-1 mt-1 note-content">${previewText}</p>
                    ${note.content.length > 100 ? 
                        `<button class="btn btn-link btn-sm p-0 text-primary" onclick="showNoteModal('${escapedContent}')">Ler mais</button>` : 
                        ''}
                </div>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary" onclick="editNote(${note.id},'${escapedContent}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteNote(${note.id})"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `;
        notesList.appendChild(noteElement);
    });
}

// Show note in modal
function showNoteModal(content) {
    const modalContent = document.createElement('div');
    modalContent.className = 'modal fade';
    modalContent.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Anotação</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p>${content.replace(/\n/g, '<br>')}</p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalContent);
    const modal = new bootstrap.Modal(modalContent);
    modal.show();
    modalContent.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modalContent);
    });
}

function getTimeLeft(habitTime) {
    const now = new Date();
    const [hours, minutes] = habitTime.split(':');
    const targetTime = new Date();
    targetTime.setHours(parseInt(hours), parseInt(minutes), 0);
    
    if (targetTime < now) {
        targetTime.setDate(targetTime.getDate() + 1);
    }
    
    const diff = targetTime - now;
    const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
    const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hoursLeft > 0) {
        return `${hoursLeft}h ${minutesLeft}min`;
    } else {
        return `${minutesLeft}min`;
    }
}

// Fetch notes from server
async function fetchNotes() {
    try {
        const response = await fetch('/api/notes');
        notes = await response.json();
        renderNotes();
    } catch (error) {
        showToast('Erro ao carregar anotações', 'error');
    }
}

// Save note
async function saveNote() {
    const noteInput = document.getElementById('note-input');
    const content = noteInput.value.trim();
    
    if (!content) return;
    
    try {
        const response = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        
        if (response.ok) {
            noteInput.value = '';
            await fetchNotes();
            showToast('Anotação salva com sucesso!', 'success');
        }
    } catch (error) {
        showToast('Erro ao salvar anotação', 'error');
    }
}

// Delete note
async function deleteNote(id) {
    if (confirm('Tem certeza que deseja excluir esta anotação?')) {
        try {
            const response = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
            if (response.ok) {
                await fetchNotes();
                showToast('Anotação excluída com sucesso!', 'success');
            }
        } catch (error) {
            showToast('Erro ao excluir anotação', 'error');
        }
    }
}

// Edit note
async function editNote(id, content) {
    const newContent = prompt('Editar anotação:', content);
    if (newContent && newContent !== content) {
        try {
            const response = await fetch(`/api/notes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newContent })
            });
            
            if (response.ok) {
                await fetchNotes();
                showToast('Anotação atualizada com sucesso!', 'success');
            }
        } catch (error) {
            showToast('Erro ao atualizar anotação', 'error');
        }
    }
}

// Function to handle day completion
async function completeDay() {
    if (!confirm('Tem certeza que deseja concluir o dia? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        const response = await fetch('/api/day-completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to complete day');
        }

        showDayCompletionModal();
        await fetchDayCompletions();
        showToast('Dia concluído com sucesso!', 'success');
    } catch (error) {
        console.error('Error completing day:', error);
        showToast(error.message || 'Erro ao concluir o dia', 'error');
    }
}

// Function to show day completion modal
function showDayCompletionModal() {
    const completedHabits = habits.filter(h => h.completed);
    const todayNotes = notes.filter(n => {
        const noteDate = new Date(n.created_at).toDateString();
        const today = new Date().toDateString();
        return noteDate === today;
    });

    const modalContent = document.createElement('div');
    modalContent.className = 'modal fade';
    modalContent.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Resumo do Dia</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <h6>Hábitos Concluídos</h6>
                    <ul class="list-group mb-3">
                        ${completedHabits.map(habit => {
                            const completedTime = habit.completed_at ? new Date(habit.completed_at).toLocaleTimeString('pt-BR') : '';
                            return `
                                <li class="list-group-item">
                                    <i class="fas fa-check-circle text-success me-2"></i>
                                    ${habit.title}
                                    <small class="text-muted">(${habit.time || 'Horário não definido'})</small>
                                    ${completedTime ? `<small class="text-success ms-2">(Concluído às ${completedTime})</small>` : ''}
                                </li>
                            `;
                        }).join('')}
                    </ul>
                    ${todayNotes.length > 0 ? `
                        <h6>Anotações do Dia</h6>
                        <ul class="list-group">
                            ${todayNotes.map(note => `
                                <li class="list-group-item">
                                    <small class="text-muted">${new Date(note.created_at).toLocaleTimeString('pt-BR')}</small>
                                    <p class="mb-0">${note.content}</p>
                                </li>
                            `).join('')}
                        </ul>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalContent);
    const modal = new bootstrap.Modal(modalContent);
    modal.show();
    modalContent.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modalContent);
    });
}

// Function to fetch day completions
async function fetchDayCompletions() {
    try {
        const response = await fetch('/api/day-completions');
        const completions = await response.json();
        renderCompletionCalendar(completions);
    } catch (error) {
        console.error('Error fetching day completions:', error);
        showToast('Erro ao carregar histórico de conclusões', 'error');
    }
}

// Function to render completion calendar
async function showHistoricalDayModal(date) {
    try {
        const response = await fetch(`/api/day-completion/${date}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch day completion details');
            return;
        }

        const modalContent = document.createElement('div');
        modalContent.className = 'modal fade';
        modalContent.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Detalhes do Dia ${new Date(date).toLocaleDateString('pt-BR')}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-4">
                            <h6 class="mb-3">Hábitos Concluídos</h6>
                            <div class="list-group">
                                ${data.habits.map(habit => `
                                    <div class="list-group-item">
                                        <div class="d-flex justify-content-between align-items-center">
                                            <div>
                                                <h6 class="mb-1">${habit.title}</h6>
                                                <small class="text-muted">
                                                    <i class="fas fa-clock"></i> ${habit.time || 'Sem horário definido'}
                                                </small>
                                            </div>
                                            <small class="text-success">
                                                Concluído às ${new Date(habit.completed_at).toLocaleTimeString('pt-BR')}
                                            </small>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ${data.notes.length > 0 ? `
                            <div>
                                <h6 class="mb-3">Anotações do Dia</h6>
                                <div class="list-group">
                                    ${data.notes.map(note => `
                                        <div class="list-group-item">
                                            <small class="text-muted">${new Date(note.created_at).toLocaleTimeString('pt-BR')}</small>
                                            <p class="mb-0 mt-1">${note.content}</p>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modalContent);
        const modal = new bootstrap.Modal(modalContent);
        modal.show();

        modalContent.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modalContent);
        });
    } catch (error) {
        console.error('Error fetching day completion details:', error);
        showToast('Erro ao carregar detalhes do dia', 'error');
    }
}

function renderCompletionCalendar(completions) {
    const calendar = document.getElementById('completion-calendar');
    calendar.innerHTML = '';

    completions.forEach(completion => {
        const date = new Date(completion.date);
        const dayElement = document.createElement('div');
        dayElement.className = 'completion-day';
        dayElement.innerHTML = `
            <div class="completion-date" data-completion-id="${completion.id}">
                <i class="fas fa-calendar-check text-success me-2"></i>
                ${date.toLocaleDateString('pt-BR')}
                <button class="btn btn-sm btn-info ms-2" onclick="showHistoricalDayModal('${completion.date}')" title="Visualizar detalhes">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-danger ms-2" onclick="deleteCompletion(${completion.id}, '${date.toLocaleDateString('pt-BR')}')" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        calendar.appendChild(dayElement);
    });
}

async function deleteCompletion(completionId, dateStr) {
    if (!confirm('Tem certeza que deseja excluir este registro de conclusão? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        const response = await fetch(`/api/day-completions/${completionId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete day completion');
        }

        await fetchDayCompletions();
        showToast('Registro de conclusão excluído com sucesso!', 'success');
    } catch (error) {
        console.error('Error deleting day completion:', error);
        showToast('Erro ao excluir o registro de conclusão', 'error');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchHabits();
    fetchNotes();
    
    // Clear form when modal is hidden
    document.getElementById('habitModal').addEventListener('hidden.bs.modal', () => {
        document.getElementById('habit-form').reset();
        document.getElementById('habit-id').value = '';
    });

    // Add note save button event listener
    document.getElementById('save-note').addEventListener('click', saveNote);

    // Add event listener for complete day button
    document.getElementById('complete-day').addEventListener('click', completeDay);
});

// Manual carousel navigation
function moveCarousel(direction) {
    const container = document.querySelector('.carousel-container');
    const cards = document.querySelectorAll('.upcoming-habit-card');
    if (cards.length <= 1) return;

    const cardWidth = 270;
    let currentPosition = parseInt(container.style.transform.replace('translateX(', '').replace('px)', '') || 0);
    const maxPosition = -(cards.length - 1) * cardWidth;

    // Calculate new position
    let newPosition = currentPosition + (direction * cardWidth);
    
    // Handle bounds
    if (newPosition > 0) newPosition = maxPosition;
    if (newPosition < maxPosition) newPosition = 0;

    // Apply transform
    container.style.transform = `translateX(${newPosition}px)`;
}

// Toast notification
function showToast(message, type = 'info') {
    Toastify({
        text: message,
        duration: 3000,
        gravity: 'top',
        position: 'right',
        style: {
            background: type === 'error' ? '#ff6b6b' : '#00b894'
        },
    }).showToast();
}

// Weekly Performance Chart
function updateWeeklyPerformanceChart() {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const completionData = new Array(7).fill(0);
    const totalData = new Array(7).fill(0);
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    habits.forEach(habit => {
        const habitDate = habit.completed_at ? new Date(habit.completed_at) : null;
        if (habitDate) {
            const dayIndex = habitDate.getDay();
            completionData[dayIndex]++;
        }
        const timeToday = new Date(`1970-01-01T${habit.time}`);
        const dayIndex = today.getDay();
        totalData[dayIndex]++;
    });

    const trace1 = {
        x: days,
        y: completionData,
        name: 'Completados',
        type: 'bar',
        marker: {
            color: 'rgba(108, 92, 231, 0.8)',
            line: {
                color: 'rgba(108, 92, 231, 1)',
                width: 1.5
            }
        }
    };

    const trace2 = {
        x: days,
        y: totalData,
        name: 'Total',
        type: 'bar',
        marker: {
            color: 'rgba(255, 255, 255, 0.2)',
            line: {
                color: 'rgba(255, 255, 255, 0.5)',
                width: 1.5
            }
        }
    };

    const layout = {
        title: 'Desempenho Semanal',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#fff' },
        barmode: 'group',
        xaxis: {
            gridcolor: 'rgba(108, 92, 231, 0.1)',
            tickfont: { color: '#fff' }
        },
        yaxis: {
            gridcolor: 'rgba(108, 92, 231, 0.1)',
            tickfont: { color: '#fff' }
        },
        showlegend: true,
        legend: {
            font: { color: '#fff' }
        }
    };

    Plotly.newPlot('performance-chart', [trace1, trace2], layout);
}

// Daily Statistics Chart
function updateDailyStatisticsChart() {
    // Get current hour
    const now = new Date();
    const currentHour = now.getHours();

    // Initialize arrays for x-axis (hours) and y-axis (completion counts)
    const hours = Array.from({length: 24}, (_, i) => i);
    const completions = new Array(24).fill(0);

    // Count completions by hour
    habits.forEach(habit => {
        if (habit.completed && habit.completed_at) {
            const completedHour = new Date(habit.completed_at).getHours();
            completions[completedHour]++;
        }
    });

    // Create the line chart trace
    const trace = {
        x: hours.map(h => `${h}:00`),
        y: completions,
        type: 'scatter',
        mode: 'lines',
        name: 'Hábitos Concluídos',
        line: {
            color: 'rgba(108, 92, 231, 1)',
            width: 3,
            shape: 'spline'
        },
        fill: 'tozeroy',
        fillcolor: 'rgba(108, 92, 231, 0.2)'
    };

    const layout = {
        title: 'Conclusões ao Longo do Dia',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#fff' },
        xaxis: {
            title: 'Hora',
            gridcolor: 'rgba(108, 92, 231, 0.1)',
            tickfont: { color: '#fff' },
            tickformat: '%H:%M'
        },
        yaxis: {
            title: 'Hábitos Concluídos',
            gridcolor: 'rgba(108, 92, 231, 0.1)',
            tickfont: { color: '#fff' },
            rangemode: 'nonnegative'
        },
        showlegend: false,
        hovermode: 'x unified',
        hoverlabel: {
            bgcolor: '#2c3e50',
            font: { color: '#fff' }
        }
    };

    Plotly.newPlot('daily-stats-chart', [trace], layout);
}

// Update the updateProgress function to include chart updates
function updateProgress() {
    const completedHabits = habits.filter(h => h.completed).length;
    const totalHabits = habits.length;
    const progress = totalHabits > 0 ? (completedHabits / totalHabits) * 100 : 0;
    
    // Update daily progress
    document.getElementById('progress-bar').style.width = `${progress}%`;
    document.getElementById('progress-bar').textContent = `${Math.round(progress)}%`;
    
    // Calculate annual progress based on daily completions
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const daysPassed = Math.floor((today - startOfYear) / (1000 * 60 * 60 * 24));
    const totalDaysInYear = new Date(today.getFullYear(), 11, 31).getDate() + 364;
    
    // Calculate annual progress percentage
    const annualProgress = (daysPassed / totalDaysInYear) * progress;
    
    // Update annual progress UI
    document.getElementById('annual-progress-bar').style.width = `${annualProgress}%`;
    document.getElementById('annual-progress-text').textContent = `${Math.round(annualProgress)}%`;

    // Update charts
    updateWeeklyPerformanceChart();
    updateDailyStatisticsChart();

    // Show/hide complete day button based on all habits being completed
    const completeDayButton = document.getElementById('complete-day');
    if (totalHabits > 0 && completedHabits === totalHabits) {
        completeDayButton.classList.remove('d-none');
    } else {
        completeDayButton.classList.add('d-none');
    }
}

// Reset habits
async function resetHabits() {
    if (confirm('Tem certeza que deseja resetar todos os hábitos?')) {
        try {
            const response = await fetch('/api/habits/reset', { method: 'POST' });
            if (response.ok) {
                await fetchHabits();
                showToast('Hábitos resetados com sucesso!', 'success');
            }
        } catch (error) {
            showToast('Erro ao resetar hábitos', 'error');
        }
    }
}

// Notes functionality
function renderNotes() {
    const notesList = document.getElementById('notes-list');
    notesList.innerHTML = '';
    
    notes.forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.className = 'list-group-item';
        
        const previewText = note.content.length > 100 ? 
            note.content.substring(0, 100) + '...' : 
            note.content;
        
        const escapedContent = note.content
            .replace(/[\\]/g, '\\\\')
            .replace(/["]/g, '\\"')
            .replace(/[\n]/g, '\\n')
            .replace(/[']/g, '\\\'')
            .replace(/[&]/g, '&amp;')
            .replace(/[<]/g, '&lt;')
            .replace(/[>]/g, '&gt;');
        
        noteElement.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div style="width: 85%;">
                    <small class="text-muted">${new Date(note.created_at).toLocaleString('pt-BR')}</small>
                    <p class="mb-1 mt-1 note-content">${previewText}</p>
                    ${note.content.length > 100 ? 
                        `<button class="btn btn-link btn-sm p-0 text-primary" onclick="showNoteModal('${escapedContent}')">Ler mais</button>` : 
                        ''}
                </div>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary" onclick="editNote(${note.id},'${escapedContent}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteNote(${note.id})"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `;
        notesList.appendChild(noteElement);
    });
}

// Show note in modal
function showNoteModal(content) {
    const modalContent = document.createElement('div');
    modalContent.className = 'modal fade';
    modalContent.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Anotação</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p>${content.replace(/\n/g, '<br>')}</p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalContent);
    const modal = new bootstrap.Modal(modalContent);
    modal.show();
    modalContent.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modalContent);
    });
}

function getTimeLeft(habitTime) {
    const now = new Date();
    const [hours, minutes] = habitTime.split(':');
    const targetTime = new Date();
    targetTime.setHours(parseInt(hours), parseInt(minutes), 0);
    
    if (targetTime < now) {
        targetTime.setDate(targetTime.getDate() + 1);
    }
    
    const diff = targetTime - now;
    const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
    const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hoursLeft > 0) {
        return `${hoursLeft}h ${minutesLeft}min`;
    } else {
        return `${minutesLeft}min`;
    }
}

// Fetch notes from server
async function fetchNotes() {
    try {
        const response = await fetch('/api/notes');
        notes = await response.json();
        renderNotes();
    } catch (error) {
        showToast('Erro ao carregar anotações', 'error');
    }
}

// Save note
async function saveNote() {
    const noteInput = document.getElementById('note-input');
    const content = noteInput.value.trim();
    
    if (!content) return;
    
    try {
        const response = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        
        if (response.ok) {
            noteInput.value = '';
            await fetchNotes();
            showToast('Anotação salva com sucesso!', 'success');
        }
    } catch (error) {
        showToast('Erro ao salvar anotação', 'error');
    }
}

// Delete note
async function deleteNote(id) {
    if (confirm('Tem certeza que deseja excluir esta anotação?')) {
        try {
            const response = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
            if (response.ok) {
                await fetchNotes();
                showToast('Anotação excluída com sucesso!', 'success');
            }
        } catch (error) {
            showToast('Erro ao excluir anotação', 'error');
        }
    }
}

// Edit note
async function editNote(id, content) {
    const newContent = prompt('Editar anotação:', content);
    if (newContent && newContent !== content) {
        try {
            const response = await fetch(`/api/notes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newContent })
            });
            
            if (response.ok) {
                await fetchNotes();
                showToast('Anotação atualizada com sucesso!', 'success');
            }
        } catch (error) {
            showToast('Erro ao atualizar anotação', 'error');
        }
    }
}

// Function to handle day completion
async function completeDay() {
    if (!confirm('Tem certeza que deseja concluir o dia? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        const response = await fetch('/api/day-completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to complete day');
        }

        showDayCompletionModal();
        await fetchDayCompletions();
        showToast('Dia concluído com sucesso!', 'success');
    } catch (error) {
        console.error('Error completing day:', error);
        showToast(error.message || 'Erro ao concluir o dia', 'error');
    }
}

// Function to show day completion modal
function showDayCompletionModal() {
    const completedHabits = habits.filter(h => h.completed);
    const todayNotes = notes.filter(n => {
        const noteDate = new Date(n.created_at).toDateString();
        const today = new Date().toDateString();
        return noteDate === today;
    });

    const modalContent = document.createElement('div');
    modalContent.className = 'modal fade';
    modalContent.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Resumo do Dia</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <h6>Hábitos Concluídos</h6>
                    <ul class="list-group mb-3">
                        ${completedHabits.map(habit => {
                            const completedTime = habit.completed_at ? new Date(habit.completed_at).toLocaleTimeString('pt-BR') : '';
                            return `
                                <li class="list-group-item">
                                    <i class="fas fa-check-circle text-success me-2"></i>
                                    ${habit.title}
                                    <small class="text-muted">(${habit.time || 'Horário não definido'})</small>
                                    ${completedTime ? `<small class="text-success ms-2">(Concluído às ${completedTime})</small>` : ''}
                                </li>
                            `;
                        }).join('')}
                    </ul>
                    ${todayNotes.length > 0 ? `
                        <h6>Anotações do Dia</h6>
                        <ul class="list-group">
                            ${todayNotes.map(note => `
                                <li class="list-group-item">
                                    <small class="text-muted">${new Date(note.created_at).toLocaleTimeString('pt-BR')}</small>
                                    <p class="mb-0">${note.content}</p>
                                </li>
                            `).join('')}
                        </ul>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalContent);
    const modal = new bootstrap.Modal(modalContent);
    modal.show();
    modalContent.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modalContent);
    });
}

// Function to fetch day completions
async function fetchDayCompletions() {
    try {
        const response = await fetch('/api/day-completions');
        const completions = await response.json();
        renderCompletionCalendar(completions);
    } catch (error) {
        console.error('Error fetching day completions:', error);
        showToast('Erro ao carregar histórico de conclusões', 'error');
    }
}

// Function to render completion calendar
async function showHistoricalDayModal(date) {
    try {
        const response = await fetch(`/api/day-completion/${date}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch day completion details');
            return;
        }

        const modalContent = document.createElement('div');
        modalContent.className = 'modal fade';
        modalContent.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Detalhes do Dia ${new Date(date).toLocaleDateString('pt-BR')}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-4">
                            <h6 class="mb-3">Hábitos Concluídos</h6>
                            <div class="list-group">
                                ${data.habits.map(habit => `
                                    <div class="list-group-item">
                                        <div class="d-flex justify-content-between align-items-center">
                                            <div>
                                                <h6 class="mb-1">${habit.title}</h6>
                                                <small class="text-muted">
                                                    <i class="fas fa-clock"></i> ${habit.time || 'Sem horário definido'}
                                                </small>
                                            </div>
                                            <small class="text-success">
                                                Concluído às ${new Date(habit.completed_at).toLocaleTimeString('pt-BR')}
                                            </small>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ${data.notes.length > 0 ? `
                            <div>
                                <h6 class="mb-3">Anotações do Dia</h6>
                                <div class="list-group">
                                    ${data.notes.map(note => `
                                        <div class="list-group-item">
                                            <small class="text-muted">${new Date(note.created_at).toLocaleTimeString('pt-BR')}</small>
                                            <p class="mb-0 mt-1">${note.content}</p>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modalContent);
        const modal = new bootstrap.Modal(modalContent);
        modal.show();

        modalContent.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modalContent);
        });
    } catch (error) {
        console.error('Error fetching day completion details:', error);
        showToast('Erro ao carregar detalhes do dia', 'error');
    }
}

function renderCompletionCalendar(completions) {
    const calendar = document.getElementById('completion-calendar');
    calendar.innerHTML = '';

    completions.forEach(completion => {
        const date = new Date(completion.date);
        const dayElement = document.createElement('div');
        dayElement.className = 'completion-day';
        dayElement.innerHTML = `
            <div class="completion-date" data-completion-id="${completion.id}">
                <i class="fas fa-calendar-check text-success me-2"></i>
                ${date.toLocaleDateString('pt-BR')}
                <button class="btn btn-sm btn-info ms-2" onclick="showHistoricalDayModal('${completion.date}')" title="Visualizar detalhes">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-danger ms-2" onclick="deleteCompletion(${completion.id}, '${date.toLocaleDateString('pt-BR')}')" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        calendar.appendChild(dayElement);
    });
}

async function deleteCompletion(completionId, dateStr) {
    if (!confirm('Tem certeza que deseja excluir este registro de conclusão? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        const response = await fetch(`/api/day-completions/${completionId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete day completion');
        }

        await fetchDayCompletions();
        showToast('Registro de conclusão excluído com sucesso!', 'success');
    } catch (error) {
        console.error('Error deleting day completion:', error);
        showToast('Erro ao excluir o registro de conclusão', 'error');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchHabits();
    fetchNotes();
    
    // Clear form when modal is hidden
    document.getElementById('habitModal').addEventListener('hidden.bs.modal', () => {
        document.getElementById('habit-form').reset();
        document.getElementById('habit-id').value = '';
    });

    // Add note save button event listener
    document.getElementById('save-note').addEventListener('click', saveNote);

    // Add event listener for complete day button
    document.getElementById('complete-day').addEventListener('click', completeDay);
});

// Manual carousel navigation
function moveCarousel(direction) {
    const container = document.querySelector('.carousel-container');
    const cards = document.querySelectorAll('.upcoming-habit-card');
    if (cards.length <= 1) return;

    const cardWidth = 270;
    let currentPosition = parseInt(container.style.transform.replace('translateX(', '').replace('px)', '') || 0);
    const maxPosition = -(cards.length - 1) * cardWidth;

    // Calculate new position
    let newPosition = currentPosition + (direction * cardWidth);
    
    // Handle bounds
    if (newPosition > 0) newPosition = maxPosition;
    if (newPosition < maxPosition) newPosition = 0;

    // Apply transform
    container.style.transform = `translateX(${newPosition}px)`;
}

// Toast notification
function showToast(message, type = 'info') {
    Toastify({
        text: message,
        duration: 3000,
        gravity: 'top',
        position: 'right',
        style: {
            background: type === 'error' ? '#ff6b6b' : '#00b894'
        },
    }).showToast();
}

// Weekly Performance Chart
function updateWeeklyPerformanceChart() {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const completionData = new Array(7).fill(0);
    const totalData = new Array(7).fill(0);
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    habits.forEach(habit => {
        const habitDate = habit.completed_at ? new Date(habit.completed_at) : null;
        if (habitDate) {
            const dayIndex = habitDate.getDay();
            completionData[dayIndex]++;
        }
        const timeToday = new Date(`1970-01-01T${habit.time}`);
        const dayIndex = today.getDay();
        totalData[dayIndex]++;
    });

    const trace1 = {
        x: days,
        y: completionData,
        name: 'Completados',
        type: 'bar',
        marker: {
            color: 'rgba(108, 92, 231, 0.8)',
            line: {
                color: 'rgba(108, 92, 231, 1)',
                width: 1.5
            }
        }
    };

    const trace2 = {
        x: days,
        y: totalData,
        name: 'Total',
        type: 'bar',
        marker: {
            color: 'rgba(255, 255, 255, 0.2)',
            line: {
                color: 'rgba(255, 255, 255, 0.5)',
                width: 1.5
            }
        }
    };

    const layout = {
        title: 'Desempenho Semanal',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#fff' },
        barmode: 'group',
        xaxis: {
            gridcolor: 'rgba(108, 92, 231, 0.1)',
            tickfont: { color: '#fff' }
        },
        yaxis: {
            gridcolor: 'rgba(108, 92, 231, 0.1)',
            tickfont: { color: '#fff' }
        },
        showlegend: true,
        legend: {
            font: { color: '#fff' }
        }
    };

    Plotly.newPlot('performance-chart', [trace1, trace2], layout);
}

// Daily Statistics Chart
function updateDailyStatisticsChart() {
    // Get current hour
    const now = new Date();
    const currentHour = now.getHours();

    // Initialize arrays for x-axis (hours) and y-axis (completion counts)
    const hours = Array.from({length: 24}, (_, i) => i);
    const completions = new Array(24).fill(0);

    // Count completions by hour
    habits.forEach(habit => {
        if (habit.completed && habit.completed_at) {
            const completedHour = new Date(habit.completed_at).getHours();
            completions[completedHour]++;
        }
    });

    // Create the line chart trace
    const trace = {
        x: hours.map(h => `${h}:00`),
        y: completions,
        type: 'scatter',
        mode: 'lines',
        name: 'Hábitos Concluídos',
        line: {
            color: 'rgba(108, 92, 231, 1)',
            width: 3,
            shape: 'spline'
        },
        fill: 'tozeroy',
        fillcolor: 'rgba(108, 92, 231, 0.2)'
    };

    const layout = {
        title: 'Conclusões ao Longo do Dia',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#fff' },
        xaxis: {
            title: 'Hora',
            gridcolor: 'rgba(108, 92, 231, 0.1)',
            tickfont: { color: '#fff' },
            tickformat: '%H:%M'
        },
        yaxis: {
            title: 'Hábitos Concluídos',
            gridcolor: 'rgba(108, 92, 231, 0.1)',
            tickfont: { color: '#fff' },
            rangemode: 'nonnegative'
        },
        showlegend: false,
        hovermode: 'x unified',
        hoverlabel: {
            bgcolor: '#2c3e50',
            font: { color: '#fff' }
        }
    };

    Plotly.newPlot('daily-stats-chart', [trace], layout);
}

// Update the updateProgress function to include chart updates
function updateProgress() {
    const completedHabits = habits.filter(h => h.completed).length;
    const totalHabits = habits.length;
    const progress = totalHabits > 0 ? (completedHabits / totalHabits) * 100 : 0;
    
    // Update daily progress
    document.getElementById('progress-bar').style.width = `${progress}%`;
    document.getElementById('progress-bar').textContent = `${Math.round(progress)}%`;
    
    // Calculate annual progress based on daily completions
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const daysPassed = Math.floor((today - startOfYear) / (1000 * 60 * 60 * 24));
    const totalDaysInYear = new Date(today.getFullYear(), 11, 31).getDate() + 364;
    
    // Calculate annual progress percentage
    const annualProgress = (daysPassed / totalDaysInYear) * progress;
    
    // Update annual progress UI
    document.getElementById('annual-progress-bar').style.width = `${annualProgress}%`;
    document.getElementById('annual-progress-text').textContent = `${Math.round(annualProgress)}%`;

    // Update charts
    updateWeeklyPerformanceChart();
    updateDailyStatisticsChart();

    // Show/hide complete day button based on all habits being completed
    const completeDayButton = document.getElementById('complete-day');
    if (totalHabits > 0 && completedHabits === totalHabits) {
        completeDayButton.classList.remove('d-none');
    } else {
        completeDayButton.classList.add('d-none');
    }
}

// Reset habits
async function resetHabits() {
    if (confirm('Tem certeza que deseja resetar todos os hábitos?')) {
        try {
            const response = await fetch('/api/habits/reset', { method: 'POST' });
            if (response.ok) {
                await fetchHabits();
                showToast('Hábitos resetados com sucesso!', 'success');
            }
        } catch (error) {
            showToast('Erro ao resetar hábitos', 'error');
        }
    }
}

// Notes functionality
function renderNotes() {
    const notesList = document.getElementById('notes-list');
    notesList.innerHTML = '';
    
    notes.forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.className = 'list-group-item';
        
        const previewText = note.content.length > 100 ? 
            note.content.substring(0, 100) + '...' : 
            note.content;
        
        const escapedContent = note.content
            .replace(/[\\]/g, '\\\\')
            .replace(/["]/g, '\\"')
            .replace(/[\n]/g, '\\n')
            .replace(/[']/g, '\\\'')
            .replace(/[&]/g, '&amp;')
            .replace(/[<]/g, '&lt;')
            .replace(/[>]/g, '&gt;');
        
        noteElement.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div style="width: 85%;">
                    <small class="text-muted">${new Date(note.created_at).toLocaleString('pt-BR')}</small>
                    <p class="mb-1 mt-1 note-content">${previewText}</p>
                    ${note.content.length > 100 ? 
                        `<button class="btn btn-link btn-sm p-0 text-primary" onclick="showNoteModal('${escapedContent}')">Ler mais</button>` : 
                        ''}
                </div>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary" onclick="editNote(${note.id},'${escapedContent}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteNote(${note.id})"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `;
        notesList.appendChild(noteElement);
    });
}

// Show note in modal
function showNoteModal(content) {
    const modalContent = document.createElement('div');
    modalContent.className = 'modal fade';
    modalContent.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Anotação</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p>${content.replace(/\n/g, '<br>')}</p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalContent);
    const modal = new bootstrap.Modal(modalContent);
    modal.show();
    modalContent.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modalContent);
    });
}

function getTimeLeft(habitTime) {
    const now = new Date();
    const [hours, minutes] = habitTime.split(':');
    const targetTime = new Date();
    targetTime.setHours(parseInt(hours), parseInt(minutes), 0);
    
    if (targetTime < now) {
        targetTime.setDate(targetTime.getDate() + 1);
    }
    
    const diff = targetTime - now;
    const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
    const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hoursLeft > 0) {
        return `${hoursLeft}h ${minutesLeft}min`;
    } else {
        return `${minutesLeft}min`;
    }
}

// Fetch notes from server
async function fetchNotes() {
    try {
        const response = await fetch('/api/notes');
        notes = await response.json();
        renderNotes();
    } catch (error) {
        showToast('Erro ao carregar anotações', 'error');
    }
}

// Save note
async function saveNote() {
    const noteInput = document.getElementById('note-input');
    const content = noteInput.value.trim();
    
    if (!content) return;
    
    try {
        const response = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        
        if (response.ok) {
            noteInput.value = '';
            await fetchNotes();
            showToast('Anotação salva com sucesso!', 'success');
        }
    } catch (error) {
        showToast('Erro ao salvar anotação', 'error');
    }
}

// Delete note
async function deleteNote(id) {
    if (confirm('Tem certeza que deseja excluir esta anotação?')) {
        try {
            const response = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
            if (response.ok) {
                await fetchNotes();
                showToast('Anotação excluída com sucesso!', 'success');
            }
        } catch (error) {
            showToast('Erro ao excluir anotação', 'error');
        }
    }
}

// Edit note
async function editNote(id, content) {
    const newContent = prompt('Editar anotação:', content);
    if (newContent && newContent !== content) {
        try {
            const response = await fetch(`/api/notes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newContent })
            });
            
            if (response.ok) {
                await fetchNotes();
                showToast('Anotação atualizada com sucesso!', 'success');
            }
        } catch (error) {
            showToast('Erro ao atualizar anotação', 'error');
        }
    }
}

// Function to handle day completion
async function completeDay() {
    if (!confirm('Tem certeza que deseja concluir o dia? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        const response = await fetch('/api/day-completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to complete day');
        }

        showDayCompletionModal();
        await fetchDayCompletions();
        showToast('Dia concluído com sucesso!', 'success');
    } catch (error) {
        console.error('Error completing day:', error);
        showToast(error.message || 'Erro ao concluir o dia', 'error');
    }
}

// Function to show day completion modal
function showDayCompletionModal() {
    const completedHabits = habits.filter(h => h.completed);
    const todayNotes = notes.filter(n => {
        const noteDate = new Date(n.created_at).toDateString();
        const today = new Date().toDateString();
        return noteDate === today;
    });

    const modalContent = document.createElement('div');
    modalContent.className = 'modal fade';
    modalContent.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Resumo do Dia</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <h6>Hábitos Concluídos</h6>
                    <ul class="list-group mb-3">
                        ${completedHabits.map(habit => {
                            const completedTime = habit.completed_at ? new Date(habit.completed_at).toLocaleTimeString('pt-BR') : '';
                            return `
                                <li class="list-group-item">
                                    <i class="fas fa-check-circle text-success me-2"></i>
                                    ${habit.title}
                                    <small class="text-muted">(${habit.time || 'Horário não definido'})</small>
                                    ${completedTime ? `<small class="text-success ms-2">(Concluído às ${completedTime})</small>` : ''}
                                </li>
                            `;
                        }).join('')}
                    </ul>
                    ${todayNotes.length > 0 ? `
                        <h6>Anotações do Dia</h6>
                        <ul class="list-group">
                            ${todayNotes.map(note => `
                                <li class="list-group-item">
                                    <small class="text-muted">${new Date(note.created_at).toLocaleTimeString('pt-BR')}</small>
                                    <p class="mb-0">${note.content}</p>
                                </li>
                            `).join('')}
                        </ul>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalContent);
    const modal = new bootstrap.Modal(modalContent);
    modal.show();
    modalContent.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modalContent);
    });
}

// Function to fetch day completions
async function fetchDayCompletions() {
    try {
        const response = await fetch('/api/day-completions');
        const completions = await response.json();
        renderCompletionCalendar(completions);
    } catch (error) {
        console.error('Error fetching day completions:', error);
        showToast('Erro ao carregar histórico de conclusões', 'error');
    }
}

// Function to render completion calendar
async function showHistoricalDayModal(date) {
    try {
        const response = await fetch(`/api/day-completion/${date}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch day completion details');
            return;
        }

        const modalContent = document.createElement('div');
        modalContent.className = 'modal fade';
        modalContent.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Detalhes do Dia ${new Date(date).toLocaleDateString('pt-BR')}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-4">
                            <h6 class="mb-3">Hábitos Concluídos</h6>
                            <div class="list-group">
                                ${data.habits.map(habit => `
                                    <div class="list-group-item">
                                        <div class="d-flex justify-content-between align-items-center">
                                            <div>
                                                <h6 class="mb-1">${habit.title}</h6>
                                                <small class="text-muted">
                                                    <i class="fas fa-clock"></i> ${habit.time || 'Sem horário definido'}
                                                </small>
                                            </div>
                                            <small class="text-success">
                                                Concluído às ${new Date(habit.completed_at).toLocaleTimeString('pt-BR')}
                                            </small>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ${data.notes.length > 0 ? `
                            <div>
                                <h6 class="mb-3">Anotações do Dia</h6>
                                <div class="list-group">
                                    ${data.notes.map(note => `
                                        <div class="list-group-item">
                                            <small class="text-muted">${new Date(note.created_at).toLocaleTimeString('pt-BR')}</small>
                                            <p class="mb-0 mt-1">${note.content}</p>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modalContent);
        const modal = new bootstrap.Modal(modalContent);
        modal.show();

        modalContent.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modalContent);
        });
    } catch (error) {
        console.error('Error fetching day completion details:', error);
        showToast('Erro ao carregar detalhes do dia', 'error');
    }
}

function renderCompletionCalendar(completions) {
    const calendar = document.getElementById('completion-calendar');
    calendar.innerHTML = '';

    completions.forEach(completion => {
        const date = new Date(completion.date);
        const dayElement = document.createElement('div');
        dayElement.className = 'completion-day';
        dayElement.innerHTML = `
            <div class="completion-date" data-completion-id="${completion.id}">
                <i class="fas fa-calendar-check text-success me-2"></i>
                ${date.toLocaleDateString('pt-BR')}
                <button class="btn btn-sm btn-info ms-2" onclick="showHistoricalDayModal('${completion.date}')" title="Visualizar detalhes">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-danger ms-2" onclick="deleteCompletion(${completion.id}, '${date.toLocaleDateString('pt-BR')}')" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        calendar.appendChild(dayElement);
    });
}

async function deleteCompletion(completionId, dateStr) {
    if (!confirm('Tem certeza que deseja excluir este registro de conclusão? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        const response = await fetch(`/api/day-completions/${completionId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete day completion');
        }

        await fetchDayCompletions();
        showToast('Registro de conclusão excluído com sucesso!', 'success');
    } catch (error) {
        console.error('Error deleting day completion:', error);
        showToast('Erro ao excluir o registro de conclusão', 'error');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchHabits();
    fetchNotes();
    
    // Clear form when modal is hidden
    document.getElementById('habitModal').addEventListener('hidden.bs.modal', () => {
        document.getElementById('habit-form').reset();
        document.getElementById('habit-id').value = '';
    });

    // Add note save button event listener
    document.getElementById('save-note').addEventListener('click', saveNote);

    // Add event listener for complete day button
    document.getElementById('complete-day').addEventListener('click', completeDay);
});

// Manual carousel navigation
function moveCarousel(direction) {
    const container = document.querySelector('.carousel-container');
    const cards = document.querySelectorAll('.upcoming-habit-card');
    if (cards.length <= 1) return;

    const cardWidth = 270;
    let currentPosition = parseInt(container.style.transform.replace('translateX(', '').replace('px)', '') || 0);
    const maxPosition = -(cards.length - 1) * cardWidth;

    // Calculate new position
    let newPosition = currentPosition + (direction * cardWidth);
    
    // Handle bounds
    if (newPosition > 0) newPosition = maxPosition;
    if (newPosition < maxPosition) newPosition = 0;

    // Apply transform
    container.style.transform = `translateX(${newPosition}px)`;
}

// Toast notification
function showToast(message, type = 'info') {
    Toastify({
        text: message,
        duration: 3000,
        gravity: 'top',
        position: 'right',
        style: {
            background: type === 'error' ? '#ff6b6b' : '#00b894'
        },
    }).showToast();
}

// Weekly Performance Chart
function updateWeeklyPerformanceChart() {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const completionData = new Array(7).fill(0);
    const totalData = new Array(7).fill(0);
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    habits.forEach(habit => {
        const habitDate = habit.completed_at ? new Date(habit.completed_at) : null;
        if (habitDate) {
            const dayIndex = habitDate.getDay();
            completionData[dayIndex]++;
        }
        const timeToday = new Date(`1970-01-01T${habit.time}`);
        const dayIndex = today.getDay();
        totalData[dayIndex]++;
    });

    const trace1 = {
        x: days,
        y: completionData,
        name: 'Completados',
        type: 'bar',
        marker: {
            color: 'rgba(108, 92, 231, 0.8)',
            line: {
                color: 'rgba(108, 92, 231, 1)',
                width: 1.5
            }
        }
    };

    const trace2 = {
        x: days,
        y: totalData,
        name: 'Total',
        type: 'bar',
        marker: {
            color: 'rgba(255, 255, 255, 0.2)',
            line: {
                color: 'rgba(255, 255, 255, 0.5)',
                width: 1.5
            }
        }
    };

    const layout = {
        title: 'Desempenho Semanal',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#fff' },
        barmode: 'group',
        xaxis: {
            gridcolor: 'rgba(108, 92, 231, 0.1)',
            tickfont: { color: '#fff' }
        },
        yaxis: {
            gridcolor: 'rgba(108, 92, 231, 0.1)',
            tickfont: { color: '#fff' }
        },
        showlegend: true,
        legend: {
            font: { color: '#fff' }
        }
    };

    Plotly.newPlot('performance-chart', [trace1, trace2], layout);
}

// Daily Statistics Chart
function updateDailyStatisticsChart() {
    // Get current hour
    const now = new Date();
    const currentHour = now.getHours();

    // Initialize arrays for x-axis (hours) and y-axis (completion counts)
    const hours = Array.from({length: 24}, (_, i) => i);
    const completions = new Array(24).fill(0);

    // Count completions by hour
    habits.forEach(habit => {
        if (habit.completed && habit.completed_at) {
            const completedHour = new Date(habit.completed_at).getHours();
            completions[completedHour]++;
        }
    });

    // Create the line chart trace
    const trace = {
        x: hours.map(h => `${h}:00`),
        y: completions,
        type: 'scatter',
        mode: 'lines',
        name: 'Hábitos Concluídos',
        line: {
            color: 'rgba(108, 92, 231, 1)',
            width: 3,
            shape: 'spline'
        },
        fill: 'tozeroy',
        fillcolor: 'rgba(108, 92, 231, 0.2)'
    };

    const layout = {
        title: 'Conclusões ao Longo do Dia',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#fff' },
        xaxis: {
            title: 'Hora',
            gridcolor: 'rgba(108, 92, 231, 0.1)',
            tickfont: { color: '#fff' },
            tickformat: '%H:%M'
        },
        yaxis: {
            title: 'Hábitos Concluídos',
            gridcolor: 'rgba(108, 92, 231, 0.1)',
            tickfont: { color: '#fff' },
            rangemode: 'nonnegative'
        },
        showlegend: false,
        hovermode: 'x unified',
        hoverlabel: {
            bgcolor: '#2c3e50',
            font: { color: '#fff' }
        }
    };

    Plotly.newPlot('daily-stats-chart', [trace], layout);
}

// Update the updateProgress function to include chart updates
function updateProgress() {
    const completedHabits = habits.filter(h => h.completed).length;
    const totalHabits = habits.length;
    const progress = totalHabits > 0 ? (completedHabits / totalHabits) * 100 : 0;
    
    // Update daily progress
    document.getElementById('progress-bar').style.width = `${progress}%`;
    document.getElementById('progress-bar').textContent = `${Math.round(progress)}%`;
    
    // Calculate annual progress based on daily completions
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const daysPassed = Math.floor((today - startOfYear) / (1000 * 60 * 60 * 24));
    const totalDaysInYear = new Date(today.getFullYear(), 11, 31).getDate() + 364;
    
    // Calculate annual progress percentage
    const annualProgress = (daysPassed / totalDaysInYear) * progress;
    
    // Update annual progress UI
    document.getElementById('annual-progress-bar').style.width = `${annualProgress}%`;
    document.getElementById('annual-progress-text').textContent = `${Math.round(annualProgress)}%`;

    // Update charts
    updateWeeklyPerformanceChart();
    updateDailyStatisticsChart();

    // Show/hide complete day button based on all habits being completed
    const completeDayButton = document.getElementById('complete-day');
    if (totalHabits > 0 && completedHabits === totalHabits) {
        completeDayButton.classList.remove('d-none');
    } else {
        completeDayButton.classList.add('d-none');
    }
}

// Reset habits
async function resetHabits() {
    if (confirm('Tem certeza que deseja resetar todos os hábitos?')) {
        try {
            const response = await fetch('/api/habits/reset', { method: 'POST' });
            if (response.ok) {
                await fetchHabits();
                showToast('Hábitos resetados com sucesso!', 'success');
            }
        } catch (error) {
            showToast('Erro ao resetar hábitos', 'error');
        }
    }
}

// Notes functionality
function renderNotes() {
    const notesList = document.getElementById('notes-list');
    notesList.innerHTML = '';
    
    notes.forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.className = 'list-group-item';
        
        const previewText = note.content.length > 100 ? 
            note.content.substring(0, 100) + '...' : 
            note.content;
        
        const escapedContent = note.content
            .replace(/[\\]/g, '\\\\')
            .replace(/["]/g, '\\"')
            .replace(/[\n]/g, '\\n')
            .replace(/[']/g, '\\\'')
            .replace(/[&]/g, '&amp;')
            .replace(/[<]/g, '&lt;')
            .replace(/[>]/g, '&gt;');
        
        noteElement.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div style="width: 85%;">
                    <small class="text-muted">${new Date(note.created_at).toLocaleString('pt-BR')}</small>
                    <p class="mb-1 mt-1 note-content">${previewText}</p>
                    ${note.content.length > 100 ? 
                        `<button class="btn btn-link btn-sm p-0 text-primary" onclick="showNoteModal('${escapedContent}')">Ler mais</button>` : 
                        ''}
                </div>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary" onclick="editNote(${note.id},'${escapedContent}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteNote(${note.id})"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `;
        notesList.appendChild(noteElement);
    });
}

// Show note in modal
function showNoteModal(content) {
    const modalContent = document.createElement('div');
    modalContent.className = 'modal fade';
    modalContent.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Anotação</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p>${content.replace(/\n/g, '<br>')}</p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalContent);
    const modal = new bootstrap.Modal(modalContent);
    modal.show();
    modalContent.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modalContent);
    });
}