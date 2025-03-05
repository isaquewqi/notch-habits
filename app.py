from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime, time
import os
import pytz

# Configure timezone
SAO_PAULO_TZ = pytz.timezone('America/Sao_Paulo')

app = Flask(__name__)
CORS(app)

# Configure SQLite database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///habits.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Models
class Habit(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(200))
    time = db.Column(db.String(50))
    category = db.Column(db.String(50), default='morning')  # 'morning', 'afternoon', or 'evening'
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(SAO_PAULO_TZ))
    checkmarks = db.relationship('HabitCheckmark', backref='habit', lazy=True, cascade='all, delete-orphan')

class HabitCheckmark(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    habit_id = db.Column(db.Integer, db.ForeignKey('habit.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    completed = db.Column(db.Boolean, default=False)
    completed_at = db.Column(db.DateTime, nullable=True)

class DayCompletion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    completed_at = db.Column(db.DateTime, nullable=False)

class Note(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Routes
# Initialize timezone for São Paulo
SAO_PAULO_TZ = pytz.timezone('America/Sao_Paulo')

@app.route('/api/habits', methods=['GET'])
def get_habits():
    habits = Habit.query.all()
    today = datetime.now(SAO_PAULO_TZ).date()
    
    habit_list = []
    for habit in habits:
        # Get today's checkmark for this habit
        checkmark = HabitCheckmark.query.filter_by(
            habit_id=habit.id,
            date=today
        ).first()
        
        habit_list.append({
            'id': habit.id,
            'title': habit.title,
            'description': habit.description,
            'time': habit.time,
            'category': habit.category,
            'completed': checkmark.completed if checkmark else False,
            'completed_at': checkmark.completed_at.astimezone(SAO_PAULO_TZ).isoformat() if checkmark and checkmark.completed_at else None
        })
    
    return jsonify(habit_list)

@app.route('/api/day-completion', methods=['POST'])
def complete_day():
    try:
        now = datetime.now(SAO_PAULO_TZ)
        today = now.date()
        
        # Check if all habits are completed for today
        habits = Habit.query.all()
        if not habits:
            return jsonify({'error': 'No habits found'}), 400
            
        for habit in habits:
            checkmark = HabitCheckmark.query.filter_by(
                habit_id=habit.id,
                date=today
            ).first()
            if not checkmark or not checkmark.completed:
                return jsonify({'error': 'Not all habits are completed for today'}), 400
        
        # Check if day is already completed
        completion = DayCompletion.query.filter_by(date=today).first()
        if completion:
            return jsonify({'error': 'Day already completed'}), 400
        
        # Create new day completion
        completion = DayCompletion(date=today, completed_at=now)
        db.session.add(completion)
        db.session.commit()
        
        return jsonify({
            'date': today.isoformat(),
            'completed_at': completion.completed_at.astimezone(SAO_PAULO_TZ).isoformat()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to complete day', 'details': str(e)}), 500

@app.route('/api/day-completions', methods=['GET'])
def get_day_completions():
    completions = DayCompletion.query.all()
    return jsonify([{
        'id': c.id,
        'date': c.date.isoformat(),
        'completed_at': c.completed_at.isoformat()
    } for c in completions])

@app.route('/api/day-completions/<int:completion_id>', methods=['DELETE'])
def delete_day_completion(completion_id):
    try:
        completion = DayCompletion.query.get_or_404(completion_id)
        db.session.delete(completion)
        db.session.commit()
        return jsonify({'message': 'Day completion deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete day completion', 'details': str(e)}), 500

@app.route('/api/habits/reset', methods=['POST'])
def reset_habits():
    try:
        # Delete all checkmarks
        HabitCheckmark.query.delete()
        # Delete all day completions
        DayCompletion.query.delete()
        # Delete all notes
        Note.query.delete()
        db.session.commit()
        return jsonify({'message': 'All habits have been reset successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to reset habits', 'details': str(e)}), 500

def get_period_from_time(time_str):
    if not time_str:
        return 'morning'  # Default period
    try:
        hours = int(time_str.split(':')[0])
        if hours < 12:
            return 'morning'
        elif hours < 18:
            return 'afternoon'
        else:
            return 'evening'
    except:
        return 'morning'  # Default to morning if time parsing fails

@app.route('/api/habits', methods=['POST'])
def create_habit():
    data = request.json
    
    # Validate required fields
    if not data.get('title', '').strip():
        return jsonify({'error': 'Title is required'}), 400
    
    time = data.get('time', '')
    category = get_period_from_time(time)
    
    new_habit = Habit(
        title=data['title'].strip(),
        description=data.get('description', '').strip(),
        time=time,
        category=category
    )
    db.session.add(new_habit)
    db.session.commit()
    return jsonify({
        'id': new_habit.id,
        'title': new_habit.title,
        'description': new_habit.description,
        'time': new_habit.time,
        'category': new_habit.category
    }), 201

@app.route('/api/habits/<int:habit_id>', methods=['PUT'])
def update_habit(habit_id):
    habit = Habit.query.get_or_404(habit_id)
    data = request.json
    habit.title = data.get('title', habit.title)
    habit.description = data.get('description', habit.description)
    habit.time = data.get('time', habit.time)
    db.session.commit()
    return jsonify({
        'id': habit.id,
        'title': habit.title,
        'description': habit.description,
        'time': habit.time
    })

@app.route('/api/habits/<int:habit_id>', methods=['DELETE'])
def delete_habit(habit_id):
    try:
        habit = Habit.query.get_or_404(habit_id)
        db.session.delete(habit)
        db.session.commit()
        return jsonify({'message': 'Habit deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete habit', 'details': str(e)}), 500

@app.route('/api/checkmarks', methods=['POST'])
def toggle_checkmark():
    data = request.json
    habit_id = data['habit_id']
    date = datetime.strptime(data['date'], '%Y-%m-%d').date()
    
    checkmark = HabitCheckmark.query.filter_by(
        habit_id=habit_id,
        date=date
    ).first()
    
    if not checkmark:
        checkmark = HabitCheckmark(habit_id=habit_id, date=date, completed=True, completed_at=datetime.now(SAO_PAULO_TZ))
        db.session.add(checkmark)
    else:
        checkmark.completed = not checkmark.completed
        checkmark.completed_at = datetime.now(SAO_PAULO_TZ) if checkmark.completed else None
    
    db.session.commit()
    return jsonify({
        'completed': checkmark.completed,
        'completed_at': checkmark.completed_at.isoformat() if checkmark.completed_at else None
    })

@app.route('/api/notes', methods=['GET', 'POST'])
def handle_notes():
    if request.method == 'GET':
        notes = Note.query.order_by(Note.created_at.desc()).all()
        return jsonify([{
            'id': note.id,
            'content': note.content,
            'created_at': note.created_at.isoformat()
        } for note in notes])
    else:
        data = request.json
        new_note = Note(content=data['content'])
        db.session.add(new_note)
        db.session.commit()
        return jsonify({
            'id': new_note.id,
            'content': new_note.content,
            'created_at': new_note.created_at.isoformat()
        }), 201

@app.route('/api/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    try:
        note = Note.query.get_or_404(note_id)
        db.session.delete(note)
        db.session.commit()
        return jsonify({'message': 'Note deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete note', 'details': str(e)}), 500

@app.route('/api/notes/<int:note_id>', methods=['PUT'])
def update_note(note_id):
    try:
        note = Note.query.get_or_404(note_id)
        data = request.json
        note.content = data.get('content', note.content)
        db.session.commit()
        return jsonify({
            'id': note.id,
            'content': note.content,
            'created_at': note.created_at.isoformat()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update note', 'details': str(e)}), 500

@app.route('/api/day-completion/<date>')
def get_day_completion(date):
    try:
        # Parse the date string to date object
        completion_date = datetime.strptime(date, '%Y-%m-%d').date()
        
        # Convert completion_date to São Paulo timezone
        completion_date_tz = SAO_PAULO_TZ.localize(datetime.combine(completion_date, time.min))
        
        # Get the day completion record
        completion = DayCompletion.query.filter_by(date=completion_date).first()
        if not completion:
            return jsonify({'error': 'Day completion not found'}), 404
        
        # Get all completed habits for that day
        checkmarks = HabitCheckmark.query.filter_by(
            date=completion_date,
            completed=True
        ).all()
        
        # Get the habit details for each checkmark
        habits = []
        for checkmark in checkmarks:
            habit = db.session.get(Habit, checkmark.habit_id)
            if habit:
                # Format time as HH:mm if it exists
                formatted_time = None
                if habit.time:
                    try:
                        time_obj = datetime.strptime(habit.time, '%H:%M').time()
                        formatted_time = time_obj.strftime('%H:%M')
                    except ValueError:
                        formatted_time = None
                
                habits.append({
                    'id': habit.id,
                    'title': habit.title,
                    'time': formatted_time,
                    'completed_at': checkmark.completed_at.astimezone(SAO_PAULO_TZ).isoformat() if checkmark.completed_at else None
                })
        
        # Get all notes created on that day
        start_of_day = datetime.combine(completion_date, time.min)
        end_of_day = datetime.combine(completion_date, time.max)
        start_of_day_tz = SAO_PAULO_TZ.localize(start_of_day)
        end_of_day_tz = SAO_PAULO_TZ.localize(end_of_day)
        
        notes = Note.query.filter(
            Note.created_at >= start_of_day_tz,
            Note.created_at <= end_of_day_tz
        ).all()
        
        return jsonify({
            'date': date,
            'completed_at': completion.completed_at.astimezone(SAO_PAULO_TZ).isoformat(),
            'habits': habits,
            'notes': [{
                'id': note.id,
                'content': note.content,
                'created_at': note.created_at.astimezone(SAO_PAULO_TZ).isoformat()
            } for note in notes]
        })
    except ValueError as e:
        return jsonify({'error': f'Invalid date format or time format: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': f'Failed to fetch day completion details: {str(e)}'}), 500

@app.route('/')
def index():
    return send_from_directory('templates', 'index.html')

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)