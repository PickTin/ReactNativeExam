import { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../calendar/Header';
import Day from '../calendar/Day';
import { fetchOffenceDates, toDateString } from '../database/offencesDatabase';
import { useAppTheme } from '../ThemeContext';

const Calendar = ({ navigation }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [offenceDates, setOffenceDates] = useState([]);
    const { colors } = useAppTheme();
    const styles = makeStyles(colors);

    useFocusEffect(useCallback(() => {
        const loadOffenceDates = async () => {
            try {
                const dates = await fetchOffenceDates();
                setOffenceDates(dates.map(item => item.date));
            } catch (error) {
                console.error('Error loading dates:', error);
            }
        };
        loadOffenceDates();
    }, []));

    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    let startDay = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;

    const prevDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const today = new Date();
    const days = [];

    for (let i = 0; i < 42; i++) {
        let date;
        let day;
        let month;

        if (i < startDay) {
            day = prevDay - startDay + i + 1;
            month = 'previous';
            date = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1 - startDay + i);
        } else if (i - startDay + 1 > daysInMonth) {
            day = i - startDay + 1 - daysInMonth;
            month = 'next';
            date = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, day);
        } else {
            day = i - startDay + 1;
            month = 'current';
            date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        }

        days.push({
            day,
            month,
            date,
            isToday: date.getDate() === today.getDate()
                && date.getMonth() === today.getMonth()
                && date.getFullYear() === today.getFullYear(),
        });
    }

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <View style={styles.container}>
            <Header currentDate={currentDate} setCurrentDate={setCurrentDate} />
            <View style={styles.weekDays}>
                {weekDays.map((day, index) => (
                    <Text style={styles.weekDay} key={index}>{day}</Text>
                ))}
            </View>
            <View style={styles.calendar}>
                {days.map((item, index) => (
                    <Day
                        key={index}
                        day={item.day}
                        month={item.month}
                        isToday={item.isToday}
                        hasTasks={offenceDates.includes(toDateString(item.date))}
                        onPress={() => navigation.navigate('DayOffences', { date: toDateString(item.date) })}
                    />
                ))}
            </View>
        </View>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    weekDays: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
    },
    weekDay: {
        width: '14.285%',
        textAlign: 'center',
        paddingVertical: 12,
        color: colors.secondaryText,
        fontWeight: '600',
    },
    calendar: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: colors.background,
    },
});

export default Calendar;
