require('dotenv').config();
const pool = require('../src/db/pool');
const { logAttendance } = require('../src/services/employeeService');

const records = [
  // 1. ام يوسف (ID 4)
  {
    name: 'ام يوسف',
    employee_id: 4,
    days: {
      '2026-07-11': { check_in: '08:20', check_out: '16:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:15', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:30', status: 'present' },
    }
  },
  // 2. ام صبية (ID 5)
  {
    name: 'ام صبية',
    employee_id: 5,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '00:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '23:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:00', status: 'present' },
    }
  },
  // 3. ام محمد الفاو (ID 6)
  {
    name: 'ام محمد الفاو',
    employee_id: 6,
    days: {
      '2026-07-11': { check_in: '08:20', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:15', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 4. حنان (ID 7)
  {
    name: 'حنان',
    employee_id: 7,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '00:00', status: 'present' },
    }
  },
  // 5. ام روديا (ID 8)
  {
    name: 'ام روديا',
    employee_id: 8,
    days: {
      '2026-07-11': { status: 'absent' },
      '2026-07-12': { status: 'absent' },
      '2026-07-13': { status: 'absent' },
      '2026-07-14': { status: 'absent' },
      '2026-07-15': { status: 'absent' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 6. منة رمضان (ID 9)
  {
    name: 'منة رمضان',
    employee_id: 9,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { status: 'absent' },
      '2026-07-15': { status: 'absent' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 7. ملك (ID 11)
  {
    name: 'ملك حسن',
    employee_id: 11,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:00', status: 'present' },
    }
  },
  // 8. أميرة (ID 12)
  {
    name: 'أميرة',
    employee_id: 12,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '13:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '15:30', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:00', status: 'present' },
    }
  },
  // 9. صباح (ID 13)
  {
    name: 'صباح',
    employee_id: 13,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '15:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:00', status: 'present' },
    }
  },
  // 10. ام مكة (ID 15)
  {
    name: 'ام مكة',
    employee_id: 15,
    days: {
      '2026-07-11': { status: 'absent' },
      '2026-07-12': { check_in: '09:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 11. ام نورة (ID 16)
  {
    name: 'ام نورة',
    employee_id: 16,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 12. دنيا حسين (ID 17)
  {
    name: 'دنيا حسين',
    employee_id: 17,
    days: {
      '2026-07-11': { check_in: '08:15', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '13:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { check_in: '14:00', check_out: '17:00', status: 'present' },
    }
  },
  // 13. دعاء (ID 18)
  {
    name: 'دعاء',
    employee_id: 18,
    days: {
      '2026-07-11': { check_in: '08:40', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:20', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:15', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:15', check_out: '17:00', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 14. ام ادم (ID 19)
  {
    name: 'ام ادم',
    employee_id: 19,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { status: 'absent' },
      '2026-07-15': { check_in: '08:00', check_out: '16:00', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 15. ام عمار(مكن) (ID 20)
  {
    name: 'ام عمار(مكن)',
    employee_id: 20,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '00:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 16. ام شهد (ID 22)
  {
    name: 'ام شهد',
    employee_id: 22,
    days: {
      '2026-07-11': { check_in: '09:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { status: 'absent', notes: 'اذن' },
      '2026-07-13': { check_in: '08:10', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 17. ام محمد (ID 23)
  {
    name: 'ام محمد',
    employee_id: 23,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { status: 'absent', notes: 'اذن' },
      '2026-07-13': { status: 'absent' },
      '2026-07-14': { status: 'absent' },
      '2026-07-15': { status: 'absent' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 18. ام رحمة (ID 25)
  {
    name: 'ام رحمة',
    employee_id: 25,
    days: {
      '2026-07-11': { status: 'absent' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 19. ياسمين (ID 26)
  {
    name: 'ياسمين',
    employee_id: 26,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { status: 'absent' },
      '2026-07-13': { check_in: '08:15', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:15', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 20. ام يونس (ID 27)
  {
    name: 'ام يونس',
    employee_id: 27,
    days: {
      '2026-07-11': { check_in: '08:15', check_out: '17:00', status: 'present' },
      '2026-07-12': { status: 'absent', notes: 'اذن' },
      '2026-07-13': { check_in: '08:15', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:15', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 21. اسماء سيد (ID 82)
  {
    name: 'اسماء سيد',
    employee_id: 82,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 22. مروان
  {
    name: 'مروان',
    employee_id: null,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '11:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:30', check_out: '17:00', status: 'present' },
      '2026-07-14': { status: 'absent' },
      '2026-07-15': { status: 'absent' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 23. عبدالرحمن (ID 30)
  {
    name: 'عبدالرحمن',
    employee_id: 30,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:11', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 24. محمد شعبان (ID 31)
  {
    name: 'محمد شعبان',
    employee_id: 31,
    days: {
      '2026-07-11': { check_in: '08:15', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:20', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:20', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:30', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:20', check_out: '17:00', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 25. مؤمن ايمن (ID 32)
  {
    name: 'مؤمن ايمن',
    employee_id: 32,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 26. ام مروان (ID 83)
  {
    name: 'ام مروان',
    employee_id: 83,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 27. محمد صبحي (ID 84)
  {
    name: 'محمد صبحي',
    employee_id: 84,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 28. زياد مفرح (ID 85)
  {
    name: 'زياد مفرح',
    employee_id: 85,
    days: {
      '2026-07-11': { status: 'absent' },
      '2026-07-12': { check_in: '08:20', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 29. امل (ID 86)
  {
    name: 'امل',
    employee_id: 86,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 30. دنيا مصطفي (ID 87)
  {
    name: 'دنيا مصطفي',
    employee_id: 87,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:20', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:20', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:15', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:15', check_out: '17:00', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 31. جرجس (ID 73)
  {
    name: 'جرجس',
    employee_id: 73,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '20:00', status: 'present' },
    }
  },
  // 32. كيرلس (ID 74)
  {
    name: 'كيرلس',
    employee_id: 74,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '20:00', status: 'present' },
    }
  },
  // 33. راغب (ID 75)
  {
    name: 'راغب',
    employee_id: 75,
    days: {
      '2026-07-11': { status: 'absent' },
      '2026-07-12': { check_in: '08:30', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:40', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:15', check_out: '20:00', status: 'present' },
      '2026-07-15': { check_in: '08:45', check_out: '20:00', status: 'present' },
      '2026-07-16': { check_in: '08:30', check_out: '20:00', status: 'present' },
    }
  },
  // 34. نور (ID 77)
  {
    name: 'نور (فرز)',
    employee_id: 77,
    days: {
      '2026-07-11': { check_in: '08:50', check_out: '18:20', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:15', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:30', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '19:00', status: 'present' },
    }
  },
  // 35. عبدالعزيز (ID 78)
  {
    name: 'عبدالعزيز',
    employee_id: 78,
    days: {
      '2026-07-11': { check_in: '09:00', check_out: '18:20', status: 'present' },
      '2026-07-12': { status: 'absent' },
      '2026-07-13': { check_in: '08:40', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:45', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '09:00', check_out: '20:00', status: 'present' },
      '2026-07-16': { check_in: '09:20', check_out: '17:00', status: 'present' },
    }
  },
  // 36. مصطفي (ID 79)
  {
    name: 'مصطفي',
    employee_id: 79,
    days: {
      '2026-07-11': { check_in: '09:00', check_out: '18:20', status: 'present' },
      '2026-07-12': { status: 'absent' },
      '2026-07-13': { status: 'absent' },
      '2026-07-14': { status: 'absent' },
      '2026-07-15': { status: 'absent' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 37. اسلام (ID 101)
  {
    name: 'اسلام',
    employee_id: 101,
    days: {
      '2026-07-11': { status: 'absent' },
      '2026-07-12': { check_in: '09:00', check_out: '19:00', status: 'present' },
      '2026-07-13': { check_in: '09:30', check_out: '20:00', status: 'present' },
      '2026-07-14': { status: 'absent' },
      '2026-07-15': { check_in: '09:00', check_out: '19:00', status: 'present' },
      '2026-07-16': { check_in: '11:00', check_out: '20:00', status: 'present' },
    }
  },
  // 38. سما (ID 55)
  {
    name: 'سما',
    employee_id: 55,
    days: {
      '2026-07-11': { status: 'absent' },
      '2026-07-12': { check_in: '08:40', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:30', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:15', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '18:00', status: 'present' },
      '2026-07-16': { check_in: '08:20', check_out: '18:00', status: 'present' },
    }
  },
  // 39. بسمة (ID 57)
  {
    name: 'بسمة',
    employee_id: 57,
    days: {
      '2026-07-11': { check_in: '09:20', check_out: '18:15', status: 'present' },
      '2026-07-12': { check_in: '09:15', check_out: '18:00', status: 'present' },
      '2026-07-13': { check_in: '09:00', check_out: '18:00', status: 'present' },
      '2026-07-14': { check_in: '09:15', check_out: '18:00', status: 'present' },
      '2026-07-15': { status: 'absent' },
      '2026-07-16': { check_in: '09:30', check_out: '18:00', status: 'present' },
    }
  },
  // 40. ابتسام (ID 58)
  {
    name: 'ابتسام',
    employee_id: 58,
    days: {
      '2026-07-11': { check_in: '08:20', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:15', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:00', status: 'present' },
    }
  },
  // 41. ملك (ID 59)
  {
    name: 'ملك',
    employee_id: 59,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '18:15', status: 'present' },
      '2026-07-12': { check_in: '08:15', check_out: '18:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '18:00', status: 'present' },
      '2026-07-14': { check_in: '08:15', check_out: '18:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '18:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '18:00', status: 'present' },
    }
  },
  // 42. اسامة (ID 61)
  {
    name: 'اسامة',
    employee_id: 61,
    days: {
      '2026-07-11': { check_in: '10:20', check_out: '20:00', status: 'present' },
      '2026-07-12': { check_in: '10:20', check_out: '20:00', status: 'present' },
      '2026-07-13': { status: 'absent' },
      '2026-07-14': { check_in: '10:00', check_out: '20:00', status: 'present' },
      '2026-07-15': { check_in: '09:30', check_out: '20:00', status: 'present' },
      '2026-07-16': { check_in: '09:00', check_out: '18:00', status: 'present' },
    }
  },
  // 43. بلال (ID 63)
  {
    name: 'بلال',
    employee_id: 63,
    days: {
      '2026-07-11': { check_in: '10:20', check_out: '20:00', status: 'present' },
      '2026-07-12': { check_in: '11:00', check_out: '20:00', status: 'present' },
      '2026-07-13': { check_in: '11:30', check_out: '21:00', status: 'present' },
      '2026-07-14': { check_in: '10:40', check_out: '20:00', status: 'present' },
      '2026-07-15': { check_in: '09:20', check_out: '20:00', status: 'present' },
      '2026-07-16': { check_in: '10:40', check_out: '20:00', status: 'present' },
    }
  },
  // 44. زياد (مكوة) (ID 64)
  {
    name: 'زياد (مكوة)',
    employee_id: 64,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:20', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '23:00', status: 'present' },
      '2026-07-13': { check_in: '09:00', check_out: '23:30', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '22:40', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '21:20', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 45. عزت (ID 65)
  {
    name: 'عزت',
    employee_id: 65,
    days: {
      '2026-07-11': { check_in: '09:00', check_out: '17:40', status: 'present' },
      '2026-07-12': { check_in: '07:00', check_out: '18:00', status: 'present' },
      '2026-07-13': { check_in: '06:00', check_out: '21:30', status: 'present' },
      '2026-07-14': { check_in: '06:00', check_out: '21:40', status: 'present' },
      '2026-07-15': { check_in: '07:00', check_out: '18:00', status: 'present' },
      '2026-07-16': { check_in: '09:00', check_out: '18:00', status: 'present' },
    }
  },
  // 46. احمد ممدوح (ID 66)
  {
    name: 'احمد ممدوح',
    employee_id: 66,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '09:00', check_out: '19:00', status: 'present' },
      '2026-07-13': { check_in: '09:20', check_out: '18:00', status: 'present' },
      '2026-07-14': { check_in: '09:15', check_out: '19:00', status: 'present' },
      '2026-07-15': { check_in: '09:00', check_out: '18:00', status: 'present' },
      '2026-07-16': { check_in: '09:00', check_out: '18:00', status: 'present' },
    }
  },
  // 47. محمد عبده (ID 68)
  {
    name: 'محمد عبده',
    employee_id: 68,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:30', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '20:00', status: 'present' },
    }
  },
  // 48. محمد عبدالعزيز (ID 102)
  {
    name: 'محمد عبدالعزيز',
    employee_id: 102,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '18:00', status: 'present' },
      '2026-07-12': { check_in: '08:15', check_out: '19:00', status: 'present' },
      '2026-07-13': { check_in: '08:15', check_out: '18:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '19:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '19:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '18:00', status: 'present' },
    }
  },
  // 49. مريم (ID 69)
  {
    name: 'مريم',
    employee_id: 69,
    days: {
      '2026-07-11': { check_in: '08:15', check_out: '20:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-14': { check_in: '08:10', check_out: '20:00', status: 'present' },
      '2026-07-15': { check_in: '09:45', check_out: '20:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:00', status: 'present' },
    }
  },
  // 50. ام عمار (ID 70)
  {
    name: 'ام عمار',
    employee_id: 70,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { status: 'absent' },
      '2026-07-14': { status: 'absent' },
      '2026-07-15': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:00', status: 'present' },
    }
  },
  // 51. سلمي (ID 71)
  {
    name: 'سلمي',
    employee_id: 71,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:00', status: 'present' },
    }
  },
  // 52. ام حمزه (ID 94)
  {
    name: 'ام حمزه',
    employee_id: 94,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:00', status: 'present' },
    }
  },
  // 53. رويدا (ID 95)
  {
    name: 'رويدا',
    employee_id: 95,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '20:00', status: 'present' },
      '2026-07-12': { status: 'absent' },
      '2026-07-13': { check_in: '08:10', check_out: '17:00', status: 'present' },
      '2026-07-14': { status: 'absent' },
      '2026-07-15': { check_in: '08:00', check_out: '19:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:30', status: 'present' },
    }
  },
  // 54. ام احمد (ID 33)
  {
    name: 'ام احمد',
    employee_id: 33,
    days: {
      '2026-07-11': { check_in: '08:30', check_out: '17:40', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '18:00', status: 'present' },
      '2026-07-13': { check_in: '08:15', check_out: '18:00', status: 'present' },
      '2026-07-14': { check_in: '08:15', check_out: '18:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:30', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:30', status: 'present' },
    }
  },
  // 55. الاء (ID 34)
  {
    name: 'الاء',
    employee_id: 34,
    days: {
      '2026-07-11': { check_in: '08:30', check_out: '17:40', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '18:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:30', status: 'present' },
      '2026-07-14': { check_in: '08:15', check_out: '18:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:30', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:30', status: 'present' },
    }
  },
  // 56. يوسف (ID 39)
  {
    name: 'يوسف',
    employee_id: 39,
    days: {
      '2026-07-11': { check_in: '13:30', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { status: 'absent' },
      '2026-07-14': { status: 'absent' },
      '2026-07-15': { status: 'absent' },
      '2026-07-16': { check_in: '08:00', check_out: '17:30', status: 'present' },
    }
  },
  // 57. منة عبدالحميد (ID 40)
  {
    name: 'منة عبدالحميد',
    employee_id: 40,
    days: {
      '2026-07-11': { check_in: '08:30', check_out: '17:40', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '18:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:30', status: 'present' },
      '2026-07-14': { check_in: '08:15', check_out: '18:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:30', status: 'present' },
      '2026-07-16': { check_in: '09:00', check_out: '19:00', status: 'present' },
    }
  },
  // 58. محمود (ID 41)
  {
    name: 'محمود',
    employee_id: 41,
    days: {
      '2026-07-11': { check_in: '08:30', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '18:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:30', status: 'present' },
      '2026-07-14': { check_in: '08:15', check_out: '18:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '19:00', status: 'present' },
      '2026-07-16': { check_in: '09:00', check_out: '19:00', status: 'present' },
    }
  },
  // 59. ام رحمة (تشطيب) (ID 45)
  {
    name: 'ام رحمة (تشطيب)',
    employee_id: 45,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { status: 'absent' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:00', status: 'present' },
    }
  },
  // 60. فاطمة (ID 46)
  {
    name: 'فاطمة',
    employee_id: 46,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:15', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 61. ام منة (ID 47)
  {
    name: 'ام منة',
    employee_id: 47,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:00', status: 'present' },
    }
  },
  // 62. ام اية (ID 49)
  {
    name: 'ام اية',
    employee_id: 49,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { status: 'absent' },
      '2026-07-13': { status: 'absent' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:00', status: 'present' },
    }
  },
  // 63. زينة (ID 51)
  {
    name: 'زينة',
    employee_id: 51,
    days: {
      '2026-07-11': { check_in: '08:10', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '09:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { status: 'absent' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:00', status: 'present' },
    }
  },
  // 64. رحمة (ID 52)
  {
    name: 'رحمة',
    employee_id: 52,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '00:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:00', status: 'present' },
    }
  },
  // 65. ام دعاء (ID 53)
  {
    name: 'ام دعاء',
    employee_id: 53,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:00', status: 'present' },
    }
  },
  // 66. منة صبحي (ID 91)
  {
    name: 'منة صبحي',
    employee_id: 91,
    days: {
      '2026-07-11': { check_in: '08:10', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:20', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:00', status: 'present' },
    }
  },
  // 67. ام بسمة (ID 99)
  {
    name: 'ام بسمة',
    employee_id: 99,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-14': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-15': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-16': { check_in: '08:00', check_out: '17:00', status: 'present' },
    }
  },
  // 68. مروان (Create if missing)
  {
    name: 'مروان',
    employee_id: null,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:00', status: 'present' },
      '2026-07-12': { check_in: '11:00', check_out: '17:00', status: 'present' },
      '2026-07-13': { check_in: '08:30', check_out: '17:00', status: 'present' },
      '2026-07-14': { status: 'absent' },
      '2026-07-15': { status: 'absent' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 69. فرح (Create if missing)
  {
    name: 'فرح',
    employee_id: null,
    days: {
      '2026-07-11': { status: 'absent' },
      '2026-07-12': { status: 'absent' },
      '2026-07-13': { status: 'absent' },
      '2026-07-14': { status: 'absent' },
      '2026-07-15': { status: 'absent' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 70. كريم (Create if missing)
  {
    name: 'كريم',
    employee_id: null,
    days: {
      '2026-07-11': { check_in: '08:00', check_out: '17:30', status: 'present' },
      '2026-07-12': { check_in: '08:15', check_out: '18:00', status: 'present' },
      '2026-07-13': { status: 'absent' },
      '2026-07-14': { check_in: '08:15', check_out: '17:30', status: 'present' },
      '2026-07-15': { status: 'absent' },
      '2026-07-16': { status: 'absent' },
    }
  },
  // 71. وفاء (Create if missing)
  {
    name: 'وفاء',
    employee_id: null,
    days: {
      '2026-07-11': { status: 'absent' },
      '2026-07-12': { status: 'absent' },
      '2026-07-13': { status: 'absent' },
      '2026-07-14': { status: 'absent' },
      '2026-07-15': { status: 'absent' },
      '2026-07-16': { status: 'absent' },
    }
  }
];

async function runImport() {
  console.log('Starting updated attendance import for week 11/7/2026 to 16/7/2026...');
  let totalSuccess = 0;
  let totalErrors = 0;

  for (const item of records) {
    let empId = item.employee_id;

    if (!empId) {
      const checkRes = await pool.query('SELECT id FROM employees WHERE name = $1', [item.name]);
      if (checkRes.rows.length > 0) {
        empId = checkRes.rows[0].id;
      } else {
        const createRes = await pool.query(
          "INSERT INTO employees (name, salary, status) VALUES ($1, 3000, 'active') RETURNING id",
          [item.name]
        );
        empId = createRes.rows[0].id;
        console.log(`Created new employee '${item.name}' with ID ${empId}`);
      }
    }

    for (const [dateStr, dayData] of Object.entries(item.days)) {
      try {
        await logAttendance(empId, { date: dateStr, ...dayData });
        totalSuccess++;
      } catch (err) {
        console.error(`Error upserting ${item.name} (ID ${empId}) on ${dateStr}:`, err.message);
        totalErrors++;
      }
    }
  }

  console.log(`Import finished! Total successful records: ${totalSuccess}, Errors: ${totalErrors}`);
}

runImport().finally(() => pool.end());
