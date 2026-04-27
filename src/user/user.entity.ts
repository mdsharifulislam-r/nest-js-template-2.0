import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  BeforeInsert,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { USER_ROLES } from 'src/utils/enums/user';
import { hashPassword } from 'src/utils/helper/bycrptHelper';

class Authentication {
  isResetPassword!: boolean;
  oneTimeCode!: number | null;
  expireAt!: Date | null;
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({
    type: 'enum',
    enum: USER_ROLES,
    default: USER_ROLES.USER,
  })
  role!: USER_ROLES;

  @Column({ nullable: true })
  contact!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ select: false })
  password!: string;

  @Column({ nullable: true })
  image!: string;

  @Column({
    type: 'enum',
    enum: ['active', 'delete'],
    default: 'active',
  })
  status!: 'active' | 'delete';

  @Column({ default: false })
  verified!: boolean;

  @Column({
    type: 'json',
    nullable: true,
    select: false,
  })
  authentication!: Authentication;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @BeforeInsert()
  async hashPasswordBeforeInsert() {
    if (!this.password) return;
    if (this.password.startsWith('$2b$')) return;
    this.password = hashPassword(this.password);
  }

  @BeforeInsert()
  setDefaultAuthentication() {
    if (!this.authentication) {
      this.authentication = {
        isResetPassword: false,
        oneTimeCode: null,
        expireAt: null,
      };
    }
  }
}

@Entity('reset_tokens')
export class ResetToken {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  token!: string;

  @Column()
  userId!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
