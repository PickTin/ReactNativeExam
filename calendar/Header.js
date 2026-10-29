import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../ThemeContext';

const Header = ({ currentDate, setCurrentDate }) => {
    const { colors } = useAppTheme();
    const styles = makeStyles(colors);
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const changeMonth = (offset) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    };

    const today = () => setCurrentDate(new Date());

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable style={styles.arrowButton} onPress={() => changeMonth(-1)}>
                    <Text style={styles.arrowText}>‹</Text>
                </Pressable>
                <Text style={styles.title}>
                    {months[currentDate.getMonth()]} {currentDate.getFullYear()}
                </Text>
                <Pressable style={styles.arrowButton} onPress={() => changeMonth(1)}>
                    <Text style={styles.arrowText}>›</Text>
                </Pressable>
            </View>
            <Pressable style={styles.todayButton} onPress={today}>
                <Text style={styles.todayText}>Сьогодні</Text>
            </Pressable>
        </View>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { backgroundColor: colors.background, paddingBottom: 12 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 24,
        paddingBottom: 12,
    },
    title: { fontSize: 20, fontWeight: '700', color: colors.text },
    arrowButton: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    arrowText: { color: colors.text, fontSize: 28, lineHeight: 30 },
    todayButton: {
        alignSelf: 'center',
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 9,
        backgroundColor: colors.button,
    },
    todayText: { color: colors.buttonText, fontWeight: '600' },
});

export default Header;
