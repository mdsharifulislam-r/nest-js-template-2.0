import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  AuthResetPasswordDto,
  ChangePasswordDto,
  ForgetPasswordDto,
  LoginDto,
  VerifyEmailDto,
} from './auth.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ResetToken, User } from 'src/user/user.entity';
import { Repository } from 'typeorm';
import { ApiError } from 'src/utils/errors/api-error';
import sendResponse from 'src/utils/helper/sendResponse';
import cryptoToken from 'src/utils/helper/cryptoToken';
import { comparePassword, hashPassword } from 'src/utils/helper/bycrptHelper';
import { JwtService } from '@nestjs/jwt';
import generateOTP from 'src/utils/helper/generateOtp';
import { emailTemplate } from 'src/utils/shared/emailTemplate';
import { EmailService } from 'src/email/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ResetToken) private readonly resetTokenRepo: Repository<ResetToken>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  private async findActiveUserByEmail(email: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        verified: true,
        status: true,
        role: true,
        authentication: true,
      },
    });

    if (!user) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'User not found');
    }
    if (user.status === 'delete') {
      throw new ApiError(HttpStatus.FORBIDDEN, 'This account has been deactivated');
    }
    return user;
  }

  async verifyOtp(payload: VerifyEmailDto) {
    const { email, oneTimeCode } = payload;
    const user = await this.findActiveUserByEmail(email);

    if (user.authentication?.oneTimeCode !== oneTimeCode) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Invalid OTP code');
    }

    if (new Date(user.authentication?.expireAt!) < new Date()) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'OTP code has expired');
    }

    const isResetPassword = user.authentication?.isResetPassword;

    // Clear OTP after use
    await this.userRepo.update(
      { id: user.id },
      {
        authentication: {
          isResetPassword: false,
          oneTimeCode: null,
          expireAt: null,
        },
        ...(!isResetPassword && { verified: true }),
      },
    );

    if (!isResetPassword) {
      return sendResponse({
        statusCode: HttpStatus.OK,
        message: 'Email verified successfully',
        data: { email: user.email },
        success: true,
      });
    }

    const token = cryptoToken();
    await this.resetTokenRepo.save(
      this.resetTokenRepo.create({ token, userId: user.id }),
    );

    return sendResponse({
      statusCode: HttpStatus.OK,
      message: 'OTP verified. Use the token to reset your password.',
      data: { token },
      success: true,
    });
  }

  async login(payload: LoginDto) {
    const user = await this.findActiveUserByEmail(payload.email);

    if (!user.verified) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'Please verify your email before logging in');
    }

    const isMatch = await comparePassword(payload.password, user.password);
    if (!isMatch) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'Invalid email or password');
    }

    const accessToken = this.jwtService.sign({
      id: user.id,
      role: user.role,
      email: user.email,
    });

    return sendResponse({
      statusCode: HttpStatus.OK,
      message: 'Login successful',
      data: { accessToken, role: user.role },
      success: true,
    });
  }

  async forgotPassword(payload: ForgetPasswordDto) {
    const user = await this.findActiveUserByEmail(payload.email);

    const otp = generateOTP();
    const template = emailTemplate.resetPassword({ email: user.email, otp });

    this.emailService.sendEmail(template).catch((err) =>
      this.logger.error(`Failed to send reset password email to ${user.email}`, err),
    );

    await this.userRepo.update(
      { id: user.id },
      {
        authentication: {
          isResetPassword: true,
          oneTimeCode: otp,
          expireAt: new Date(Date.now() + 3 * 60 * 1000),
        },
      },
    );

    return sendResponse({
      statusCode: HttpStatus.OK,
      message: 'Password reset OTP sent to your email',
      data: { email: user.email },
      success: true,
    });
  }

  async resetPassword(payload: AuthResetPasswordDto, token: string) {
    if (payload.newPassword !== payload.confirmPassword) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Passwords do not match');
    }

    const resetToken = await this.resetTokenRepo.findOne({ where: { token } });
    if (!resetToken) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Invalid or expired reset token');
    }

    const user = await this.userRepo.findOne({
      where: { id: resetToken.userId },
      select: { id: true, email: true, password: true, status: true },
    });

    if (!user) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'User not found');
    }
    if (user.status === 'delete') {
      throw new ApiError(HttpStatus.FORBIDDEN, 'This account has been deactivated');
    }

    const isSamePassword = await comparePassword(payload.newPassword, user.password);
    if (isSamePassword) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'New password cannot be the same as the current password');
    }

    await this.userRepo.update(
      { id: user.id },
      {
        password: hashPassword(payload.newPassword),
        authentication: { isResetPassword: false, oneTimeCode: null, expireAt: null },
      },
    );

    await this.resetTokenRepo.delete({ id: resetToken.id });

    return sendResponse({
      statusCode: HttpStatus.OK,
      message: 'Password reset successfully. You can now log in.',
      data: { email: user.email },
      success: true,
    });
  }

  async changePassword(payload: ChangePasswordDto, userId: string) {
    if (payload.newPassword !== payload.confirmPassword) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'New password and confirm password do not match');
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: { id: true, email: true, password: true, status: true },
    });

    if (!user) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'User not found');
    }
    if (user.status === 'delete') {
      throw new ApiError(HttpStatus.FORBIDDEN, 'This account has been deactivated');
    }

    const isMatch = await comparePassword(payload.currentPassword, user.password);
    if (!isMatch) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'Current password is incorrect');
    }

    if (payload.currentPassword === payload.newPassword) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'New password must differ from the current password');
    }

    await this.userRepo.update(
      { id: user.id },
      { password: hashPassword(payload.newPassword) },
    );

    return sendResponse({
      statusCode: HttpStatus.OK,
      message: 'Password changed successfully',
      data: { email: user.email },
      success: true,
    });
  }
}
